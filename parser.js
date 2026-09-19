(function (window) {
  "use strict";

  const aliases = {
    revenue: ["total revenues", "total revenue", "net revenues", "net revenue", "net sales", "total sales", "revenues", "revenue", "sales"],
    grossProfit: ["gross profit", "gross margin"],
    netIncome: ["net income", "net earnings", "net profit", "profit for the year", "income attributable to"],
    operatingCashFlow: ["net cash provided by operating activities", "cash provided by operating activities", "net cash from operating activities"],
    currentAssets: ["total current assets", "current assets"],
    currentLiabilities: ["total current liabilities", "current liabilities"],
    shortDebt: ["short-term debt", "short term debt", "current portion of long-term debt", "current maturities of long-term debt"],
    longDebt: ["long-term debt", "long term debt", "long-term borrowings", "long term borrowings"],
    equity: ["total stockholders' equity", "total shareholders' equity", "total equity", "shareholders' equity", "stockholders' equity"],
    costOfRevenue: ["cost of revenue", "cost of revenues", "cost of sales", "cost of goods sold"]
  };

  const clean = value => String(value || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\r/g, "").trim();
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  const progress = (fn, value, step, detail) => { if (typeof fn === "function") fn({ value, step, detail }); };

  function numberFromToken(token) {
    let value = String(token || "").trim()
      .replace(/[$€£¥,%]/g, "")
      .replace(/[†‡*]/g, "")
      .replace(/,/g, "")
      .replace(/\s/g, "");
    if (!value || /^[-–—]+$/.test(value)) return null;
    const negative = /^\(.*\)$/.test(value);
    value = value.replace(/[()]/g, "");
    if (!/^\d*\.?\d+$/.test(value)) return null;
    const result = Number(value);
    return Number.isFinite(result) ? (negative ? -result : result) : null;
  }

  function numericTokens(line) {
    const matches = String(line).match(/(?:\(?[$€£¥]?\d[\d,]*(?:\.\d+)?\)?)(?:[†‡*])?/g) || [];
    return matches.map(numberFromToken).filter(Number.isFinite);
  }

  function detectUnits(text) {
    const head = text.slice(0, 30000).toLowerCase();
    if (/\bin\s+billions?\b|\$\s*in\s+billions?/.test(head)) return { label: "Billions", multiplier: 1e9 };
    if (/\bin\s+millions?\b|\$\s*in\s+millions?/.test(head)) return { label: "Millions", multiplier: 1e6 };
    if (/\bin\s+thousands?\b|\$\s*in\s+thousands?/.test(head)) return { label: "Thousands", multiplier: 1e3 };
    return { label: "As reported", multiplier: 1 };
  }

  function detectYears(text) {
    const years = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(match => Number(match[1]));
    const current = new Date().getFullYear() + 1;
    return [...new Set(years.filter(year => year >= 1990 && year <= current))].sort((a, b) => b - a).slice(0, 3);
  }

  function companyName(text, filename) {
    const first = text.slice(0, 6000);
    const cover = first.match(/(?:^|\n)\s*([A-Z][A-Z ,.'&-]{3,80})\s*(?:\n|$)/g);
    if (cover) {
      const candidate = cover.map(v => clean(v)).find(v => !/UNITED STATES|SECURITIES|COMMISSION|FORM 10-K|ANNUAL REPORT/.test(v));
      if (candidate) return candidate.replace(/\s+/g, " ");
    }
    return filename.replace(/\.[^.]+$/, "") || "Uploaded filing";
  }

  function statementScore(text, index) {
    const section = text.slice(Math.max(0, index - 2500), index + 2500).toLowerCase();
    let score = 0;
    if (/consolidated statements? of (operations|income|earnings)/.test(section)) score += 8;
    if (/consolidated balance sheets?/.test(section)) score += 8;
    if (/consolidated statements? of cash flows?/.test(section)) score += 8;
    if (/years? ended|year ended/.test(section)) score += 3;
    if (/segment/.test(section)) score -= 5;
    if (/quarter/.test(section)) score -= 3;
    return score;
  }

  function findMetric(text, metric, units) {
    const lines = text.split("\n").map(clean).filter(Boolean);
    const terms = aliases[metric];
    const candidates = [];

    lines.forEach((line, lineIndex) => {
      const lower = line.toLowerCase();
      for (const term of terms) {
        const expression = new RegExp(`(^|\\W)${escape(term)}(\\W|$)`, "i");
        if (!expression.test(lower)) continue;
        const numbers = numericTokens(line);
        if (!numbers.length) continue;
        const index = text.indexOf(line);
        let score = statementScore(text, index) + term.length / 20;
        if (/note |notes to|quarter|three months/.test(lower)) score -= 3;
        if (/total /.test(lower)) score += 1;
        candidates.push({ line, lineIndex, values: numbers.slice(0, 3).map(value => value * units.multiplier), score, source: "Reported" });
        break;
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    if (!candidates.length) return { current: null, previous: null, source: "N/A", confidence: "Unavailable" };

    const best = candidates[0];
    return {
      current: best.values[0] ?? null,
      previous: best.values[1] ?? null,
      source: "Reported",
      confidence: best.score >= 8 ? "Statement-context candidate" : "Context uncertain",
      evidence: best.line
    };
  }

  function calculateGrossProfit(metrics) {
    const revenue = metrics.revenue;
    const cost = metrics.costOfRevenue;
    if (revenue.current != null && cost.current != null) {
      return {
        current: revenue.current - cost.current,
        previous: revenue.previous != null && cost.previous != null ? revenue.previous - cost.previous : null,
        source: "Calculated",
        confidence: "Revenue less cost of revenue",
        evidence: "Calculated from extracted revenue and cost of revenue."
      };
    }
    return metrics.grossProfit;
  }

  function goingConcern(text) {
    const patterns = [
      /substantial doubt.{0,400}/ig,
      /going concern.{0,400}/ig,
      /material uncertainty.{0,400}/ig,
      /liquidity (?:issues|constraints|shortfall|risk).{0,300}/ig,
      /covenant (?:violation|breach|compliance).{0,300}/ig
    ];
    const findings = [];
    patterns.forEach(pattern => {
      const match = pattern.exec(text);
      if (match) findings.push(clean(match[0]));
    });
    return {
      findings: [...new Set(findings)].slice(0, 3),
      status: findings.length ? "Disclosure or indicator found" : "No explicit disclosure identified",
      note: findings.length
        ? "The excerpts below require human review. A keyword or disclosure alone is not a professional going-concern conclusion."
        : "FORGE did not identify an explicit going-concern phrase. Its absence does not establish that no financial or liquidity risk exists."
    };
  }

  async function extract(file, onProgress) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    progress(onProgress, 10, "Reading document", file.name);

    if (ext === "pdf") {
      if (!window.pdfjsLib) throw new Error("PDF parsing library did not load. Refresh the page and try again.");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const bytes = new Uint8Array(await file.arrayBuffer());
      let pdf;
      try { pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise; }
      catch { throw new Error("FORGE could not open this PDF. It may be encrypted, damaged, or unsupported."); }

      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(" "));
        progress(onProgress, 10 + Math.round((pageNumber / pdf.numPages) * 40), "Extracting financial tables", `Reading page ${pageNumber} of ${pdf.numPages}`);
        await pause();
      }
      const text = clean(pages.join("\n"));
      if (text.length < 200) throw new Error("No extractable text was found. This may be an image-only or scanned PDF and OCR would be required.");
      return { text, type: "PDF", pages: pdf.numPages };
    }

    if (ext === "docx") {
      if (!window.mammoth) throw new Error("DOCX parsing library did not load. Refresh the page and try again.");
      const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const text = clean(result.value);
      if (text.length < 100) throw new Error("The DOCX contains too little readable text for reliable analysis.");
      return { text, type: "DOCX", pages: null };
    }

    if (["xlsx", "xls"].includes(ext)) {
      if (!window.XLSX) throw new Error("Spreadsheet parsing library did not load. Refresh the page and try again.");
      const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
      const text = workbook.SheetNames.map(name => `SHEET: ${name}\n${window.XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join("\n\n");
      if (clean(text).length < 50) throw new Error("The spreadsheet contains too little readable information for analysis.");
      return { text: clean(text), type: "Spreadsheet", pages: null };
    }

    if (["csv", "txt", "html", "htm"].includes(ext)) {
      const raw = await file.text();
      const text = clean(ext === "html" || ext === "htm" ? new DOMParser().parseFromString(raw, "text/html").body.textContent : raw);
      if (text.length < 50) throw new Error("The uploaded file contains too little readable text for analysis.");
      return { text, type: ext.toUpperCase(), pages: null };
    }

    throw new Error("Unsupported file type.");
  }

  async function analyzeFile(file, onProgress) {
    const extracted = await extract(file, onProgress);
    progress(onProgress, 55, "Identifying fiscal periods", "Locating annual financial-statement context.");
    const units = detectUnits(extracted.text);
    const years = detectYears(extracted.text);
    const metrics = {};

    for (const metric of Object.keys(aliases)) {
      metrics[metric] = findMetric(extracted.text, metric, units);
      await pause();
    }

    metrics.grossProfit = calculateGrossProfit(metrics);
    progress(onProgress, 75, "Normalising financial data", `Amounts interpreted as ${units.label.toLowerCase()}.`);

    return {
      fileName: file.name,
      sourceType: extracted.type,
      companyName: companyName(extracted.text, file.name),
      years,
      units,
      metrics,
      goingConcern: goingConcern(extracted.text),
      extractedTextLength: extracted.text.length,
      analyzedAt: new Date().toISOString()
    };
  }

  window.ForgeParser = { analyzeFile };
})(window);
