/* =========================================================
   FORGE — parser.js
   Browser-only financial document parser and analyzer
   Supports: PDF, DOCX, XLSX, XLS, CSV, TXT
   No backend. No sample data. No API.
   ========================================================= */

(function (window) {
  "use strict";

  const CURRENT_YEAR = new Date().getFullYear();

  /* ---------------------------------------------------------
     Utility helpers
     --------------------------------------------------------- */

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeLine(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[‐-‒–—]/g, "-")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function unique(array) {
    return [...new Set(array)];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function average(values) {
    const valid = values.filter(Number.isFinite);
    if (!valid.length) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  function round(value, decimals = 2) {
    if (!Number.isFinite(value)) return null;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  function formatPercent(value) {
    return Number.isFinite(value) ? round(value, 1) : null;
  }

  function safeNumber(value) {
    return Number.isFinite(value) ? value : null;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function report(progress, message, detail) {
    if (typeof progress === "function") {
      progress({
        progress: clamp(Math.round(progress.value || 0), 0, 100),
        message: message || "",
        detail: detail || ""
      });
    }
  }

  function emitProgress(callback, value, message, detail) {
    if (typeof callback === "function") {
      callback({
        progress: clamp(Math.round(value), 0, 100),
        message,
        detail
      });
    }
  }

  /* ---------------------------------------------------------
     Concept dictionary
     --------------------------------------------------------- */

  const ALIASES = {
    revenue: [
      "total revenues",
      "total revenue",
      "net revenues",
      "net revenue",
      "total net sales",
      "net sales",
      "total sales",
      "sales revenue",
      "operating revenues",
      "operating revenue",
      "revenues",
      "revenue",
      "sales"
    ],

    costOfRevenue: [
      "cost of revenues",
      "cost of revenue",
      "cost of sales",
      "cost of goods sold",
      "cost of goods and services sold",
      "cost of products sold",
      "cost of products and services sold",
      "cost of services",
      "cost of goods and services",
      "costs of revenues",
      "costs of revenue"
    ],

    grossProfit: [
      "gross profit",
      "gross profits"
    ],

    netIncome: [
      "net income attributable to the company",
      "net income attributable to company",
      "net income attributable to parent",
      "net income attributable to shareholders",
      "net income attributable to common stockholders",
      "net earnings attributable to the company",
      "net earnings attributable to shareholders",
      "net income",
      "net earnings",
      "net loss",
      "net profit"
    ],

    currentAssets: [
      "total current assets",
      "current assets"
    ],

    currentLiabilities: [
      "total current liabilities",
      "current liabilities"
    ],

    shortTermDebt: [
      "short-term debt",
      "short term debt",
      "short-term borrowings",
      "short term borrowings",
      "current portion of long-term debt",
      "current maturities of long-term debt",
      "current portion of debt",
      "current debt",
      "short-term borrowings and current portion of long-term debt"
    ],

    longTermDebt: [
      "long-term debt",
      "long term debt",
      "long-term borrowings",
      "long term borrowings",
      "non-current debt",
      "noncurrent debt"
    ],

    totalDebt: [
      "total debt",
      "total borrowings",
      "debt outstanding"
    ],

    equity: [
      "total shareholders' equity",
      "total stockholders' equity",
      "total shareholders’ equity",
      "total stockholders’ equity",
      "shareholders' equity",
      "stockholders' equity",
      "shareholders’ equity",
      "stockholders’ equity",
      "total equity",
      "total stockholders equity",
      "total shareholders equity"
    ],

    operatingCashFlow: [
      "net cash provided by operating activities",
      "net cash provided from operating activities",
      "net cash flows provided by operating activities",
      "net cash generated by operating activities",
      "cash provided by operating activities",
      "cash generated from operating activities",
      "cash flows from operating activities",
      "net cash from operating activities",
      "operating cash flow"
    ]
  };

  const DISPLAY_NAMES = {
    revenue: "Revenue",
    costOfRevenue: "Cost of revenue",
    grossProfit: "Gross profit",
    netIncome: "Net profit",
    currentAssets: "Current assets",
    currentLiabilities: "Current liabilities",
    shortTermDebt: "Short-term debt",
    longTermDebt: "Long-term debt",
    totalDebt: "Total debt",
    equity: "Shareholders' equity",
    operatingCashFlow: "Operating cash flow"
  };

  /* ---------------------------------------------------------
     File extraction
     --------------------------------------------------------- */

  async function extractFile(file, onProgress) {
    if (!file) {
      throw new Error("No file was provided.");
    }

    const name = file.name || "document";
    const extension = name.includes(".")
      ? name.split(".").pop().toLowerCase()
      : "";

    emitProgress(
      onProgress,
      5,
      "Reading file",
      `${name} • ${formatBytes(file.size)}`
    );

    if (extension === "pdf") {
      return extractPDF(file, onProgress);
    }

    if (extension === "docx") {
      return extractDOCX(file, onProgress);
    }

    if (extension === "xlsx" || extension === "xls") {
      return extractSpreadsheet(file, onProgress);
    }

    if (extension === "csv") {
      const text = await file.text();

      return {
        text: cleanText(text),
        pages: 1,
        pageTexts: [cleanText(text)],
        type: "csv"
      };
    }

    if (
      extension === "txt" ||
      extension === "text" ||
      extension === "html" ||
      extension === "htm"
    ) {
      const text = await file.text();

      return {
        text: cleanText(text),
        pages: 1,
        pageTexts: [cleanText(text)],
        type: extension
      };
    }

    throw new Error(
      `Unsupported file type ".${extension || "unknown"}". Upload a PDF, DOCX, XLSX, XLS, CSV or TXT file.`
    );
  }

  /* ---------------------------------------------------------
     PDF extraction
     --------------------------------------------------------- */

  async function extractPDF(file, onProgress) {
    if (!window.pdfjsLib) {
      throw new Error(
        "PDF.js is not available. The PDF parsing library has not loaded correctly."
      );
    }

    const buffer = await file.arrayBuffer();

    let pdf;

    try {
      pdf = await window.pdfjsLib
        .getDocument({
          data: buffer
        })
        .promise;
    } catch (error) {
      throw new Error(
        "Forge could not open this PDF. It may be encrypted, damaged, or unsupported."
      );
    }

    const pageTexts = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      const items = content.items || [];

      /*
       * PDF text is reconstructed using the item's coordinates.
       * This gives financial tables a much better chance of retaining
       * their row structure than simply joining every text item.
       */

      const positioned = items
        .filter(item => item && typeof item.str === "string")
        .map(item => {
          const transform = item.transform || [];
          return {
            text: item.str,
            x: Number(transform[4]) || 0,
            y: Number(transform[5]) || 0
          };
        });

      const rows = [];

      positioned.forEach(item => {
        let row = rows.find(existing =>
          Math.abs(existing.y - item.y) <= 3
        );

        if (!row) {
          row = {
            y: item.y,
            items: []
          };
          rows.push(row);
        }

        row.items.push(item);
      });

      rows.sort((a, b) => b.y - a.y);

      const pageLines = rows.map(row => {
        row.items.sort((a, b) => a.x - b.x);

        return normalizeLine(
          row.items
            .map(item => item.text)
            .join(" ")
        );
      }).filter(Boolean);

      const pageText = pageLines.join("\n");

      pageTexts.push(pageText);

      const percentage =
        8 + ((pageNumber / Math.max(pdf.numPages, 1)) * 27);

      emitProgress(
        onProgress,
        percentage,
        "Extracting text",
        `Reading page ${pageNumber} of ${pdf.numPages}`
      );

      /*
       * Small yield keeps the progress interface responsive on large
       * filings instead of locking the browser for the entire parse.
       */
      await sleep(8);
    }

    const combined = pageTexts
      .map((text, index) => `--- PAGE ${index + 1} ---\n${text}`)
      .join("\n\n");

    const cleaned = cleanText(combined);

    if (cleaned.length < 500) {
      throw new Error(
        "Very little text could be extracted from this PDF. It may be scanned or image-only. Forge currently requires selectable text for reliable financial extraction."
      );
    }

    return {
      text: cleaned,
      pages: pdf.numPages,
      pageTexts,
      type: "pdf"
    };
  }

  /* ---------------------------------------------------------
     DOCX extraction
     --------------------------------------------------------- */

  async function extractDOCX(file, onProgress) {
    if (!window.mammoth) {
      throw new Error(
        "Mammoth.js is not available. The DOCX parsing library has not loaded correctly."
      );
    }

    emitProgress(
      onProgress,
      15,
      "Extracting text",
      "Reading Word document"
    );

    const buffer = await file.arrayBuffer();

    let result;

    try {
      result = await window.mammoth.extractRawText({
        arrayBuffer: buffer
      });
    } catch (error) {
      throw new Error(
        "Forge could not extract text from this DOCX file."
      );
    }

    const text = cleanText(result.value);

    if (text.length < 300) {
      throw new Error(
        "The DOCX contains too little readable text for reliable financial analysis."
      );
    }

    emitProgress(
      onProgress,
      35,
      "Extracting text",
      "Word document extraction complete"
    );

    return {
      text,
      pages: 1,
      pageTexts: [text],
      type: "docx"
    };
  }

  /* ---------------------------------------------------------
     Spreadsheet extraction
     --------------------------------------------------------- */

  async function extractSpreadsheet(file, onProgress) {
    if (!window.XLSX) {
      throw new Error(
        "SheetJS is not available. The spreadsheet parsing library has not loaded correctly."
      );
    }

    emitProgress(
      onProgress,
      15,
      "Extracting text",
      "Reading spreadsheet"
    );

    const buffer = await file.arrayBuffer();

    let workbook;

    try {
      workbook = window.XLSX.read(buffer, {
        type: "array",
        cellDates: false
      });
    } catch (error) {
      throw new Error(
        "Forge could not read this spreadsheet."
      );
    }

    const sections = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];

      const csv = window.XLSX.utils.sheet_to_csv(sheet, {
        blankrows: false
      });

      sections.push(
        `--- SHEET: ${sheetName} ---\n${csv}`
      );
    });

    const text = cleanText(sections.join("\n\n"));

    if (text.length < 100) {
      throw new Error(
        "The spreadsheet contains too little readable information for analysis."
      );
    }

    emitProgress(
      onProgress,
      35,
      "Extracting text",
      `${workbook.SheetNames.length} sheet(s) processed`
    );

    return {
      text,
      pages: workbook.SheetNames.length,
      pageTexts: sections,
      type: "spreadsheet"
    };
  }

  /* ---------------------------------------------------------
     Document identification
     --------------------------------------------------------- */

  function detectDocument(text, fileName) {
    const upper = text.toUpperCase();

    const is10K =
      /\bFORM\s+10-K\b/.test(upper) ||
      /\b10-K\b/.test(upper) ||
      (
        /SECURITIES AND EXCHANGE COMMISSION/.test(upper) &&
        /ANNUAL REPORT/.test(upper)
      );

    const isAnnualReport =
      /ANNUAL REPORT/.test(upper) ||
      /YEAR ENDED/.test(upper) ||
      /FISCAL YEAR/.test(upper);

    const fiscalYears = extractYears(text);

    const companyName = detectCompanyName(text, fileName);

    return {
      is10K,
      isAnnualReport,
      companyName,
      fiscalYears
    };
  }

  function detectCompanyName(text, fileName) {
    const firstPart = text.slice(0, 12000);

    const patterns = [
      /(?:Exact name of registrant as specified in its charter)\s*[:\-]?\s*([^\n]+)/i,
      /(?:Registrant's name)\s*[:\-]?\s*([^\n]+)/i,
      /(?:Company Name)\s*[:\-]?\s*([^\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = firstPart.match(pattern);

      if (match && match[1]) {
        const value = cleanCompanyCandidate(match[1]);

        if (value.length >= 2) {
          return value;
        }
      }
    }

    const lines = firstPart
      .split("\n")
      .map(normalizeLine)
      .filter(Boolean);

    const ignored = [
      "UNITED STATES",
      "SECURITIES AND EXCHANGE COMMISSION",
      "WASHINGTON",
      "FORM 10-K",
      "ANNUAL REPORT",
      "COMMISSION FILE NUMBER",
      "FOR THE FISCAL YEAR"
    ];

    for (const line of lines.slice(0, 80)) {
      const upper = line.toUpperCase();

      if (
        line.length >= 3 &&
        line.length <= 100 &&
        !ignored.some(item => upper.includes(item)) &&
        !/^\d+$/.test(line) &&
        !/\b20\d{2}\b/.test(line)
      ) {
        if (
          /INC\.?|CORPORATION|CORP\.?|COMPANY|PLC|LIMITED|LTD\.?|LLC|HOLDINGS|GROUP/i.test(line)
        ) {
          return cleanCompanyCandidate(line);
        }
      }
    }

    const baseName = String(fileName || "")
      .replace(/\.[^.]+$/, "")
      .replace(/[_\-]+/g, " ")
      .trim();

    return baseName || "Uploaded company";
  }

  function cleanCompanyCandidate(value) {
    return String(value)
      .replace(/\s+/g, " ")
      .replace(/^[\s:;\-]+|[\s:;,\-]+$/g, "")
      .trim();
  }

  function extractYears(text) {
    const matches = text.match(/\b(?:19|20)\d{2}\b/g) || [];

    return unique(
      matches
        .map(Number)
        .filter(year =>
          year >= 1990 &&
          year <= CURRENT_YEAR + 2
        )
    ).sort((a, b) => b - a);
  }

  /* ---------------------------------------------------------
     Text normalization
     --------------------------------------------------------- */

  function normalizeFinancialText(text) {
    return String(text || "")
      .replace(/\u2019/g, "'")
      .replace(/\u2018/g, "'")
      .replace(/\u201C/g, '"')
      .replace(/\u201D/g, '"')
      .replace(/[‐-‒–—]/g, "-")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function getLines(text) {
    return normalizeFinancialText(text)
      .split("\n")
      .map(normalizeLine)
      .filter(Boolean);
  }

  /* ---------------------------------------------------------
     Number extraction
     --------------------------------------------------------- */

  function parseNumberToken(token) {
    if (token === null || token === undefined) return null;

    let value = String(token)
      .trim()
      .replace(/[$€£₹¥]/g, "")
      .replace(/,/g, "")
      .replace(/\s+/g, "");

    if (!value) return null;

    if (
      value === "-" ||
      value === "—" ||
      value === "–" ||
      value === "—"
    ) {
      return null;
    }

    const negative =
      /^\(.*\)$/.test(value) ||
      /^-/.test(value);

    value = value
      .replace(/^\(/, "")
      .replace(/\)$/, "")
      .replace(/^-/, "");

    const match = value.match(
      /^(\d+(?:\.\d+)?)(million|billion|thousand|m|bn|k)?$/i
    );

    if (!match) return null;

    let number = Number(match[1]);

    if (!Number.isFinite(number)) return null;

    const suffix = String(match[2] || "").toLowerCase();

    if (suffix === "million" || suffix === "m") {
      number *= 1e6;
    } else if (suffix === "billion" || suffix === "bn") {
      number *= 1e9;
    } else if (suffix === "thousand" || suffix === "k") {
      number *= 1e3;
    }

    return negative ? -number : number;
  }

  function extractNumberCandidates(line) {
    const source = String(line || "");

    const regex =
      /(?:[$€£₹¥]\s*)?(?:\(?-?\d[\d,]*(?:\.\d+)?\)?)(?:\s*(?:million|billion|thousand|m|bn|k))?/gi;

    const matches = source.match(regex) || [];

    const values = [];

    matches.forEach(raw => {
      const clean = raw.trim();

      const numericOnly = clean.replace(
        /[$€£₹¥\s,()\-]/g,
        ""
      );

      /*
       * Do not treat ordinary years as financial values.
       */
      if (
        /^\d{4}$/.test(numericOnly) &&
        Number(numericOnly) >= 1900 &&
        Number(numericOnly) <= CURRENT_YEAR + 2
      ) {
        return;
      }

      const value = parseNumberToken(clean);

      if (Number.isFinite(value)) {
        values.push({
          raw: clean,
          value
        });
      }
    });

    return values;
  }

  function detectScale(text) {
    const source = String(text || "").toLowerCase();

    const patterns = [
      {
        regex: /\bin\s+billions?\b/,
        multiplier: 1e9,
        label: "billions"
      },
      {
        regex: /\bin\s+millions?\b/,
        multiplier: 1e6,
        label: "millions"
      },
      {
        regex: /\bin\s+thousands?\b/,
        multiplier: 1e3,
        label: "thousands"
      }
    ];

    for (const item of patterns) {
      if (item.regex.test(source)) {
        return item;
      }
    }

    return {
      multiplier: 1,
      label: "units"
    };
  }

  function nearbyScale(lines, index) {
    const start = Math.max(0, index - 12);
    const end = Math.min(lines.length, index + 13);

    return detectScale(
      lines.slice(start, end).join(" ")
    );
  }

  /* ---------------------------------------------------------
     Year context
     --------------------------------------------------------- */

  function extractYearsFromText(text) {
    return unique(
      (String(text || "").match(/\b(?:19|20)\d{2}\b/g) || [])
        .map(Number)
        .filter(year =>
          year >= 1990 &&
          year <= CURRENT_YEAR + 2
        )
    );
  }

  function findYearContext(lines, index) {
    const start = Math.max(0, index - 8);
    const end = Math.min(lines.length, index + 4);

    const windowLines = lines.slice(start, end);

    const years = [];

    windowLines.forEach(line => {
      extractYearsFromText(line).forEach(year => {
        if (!years.includes(year)) {
          years.push(year);
        }
      });
    });

    /*
     * Financial statements usually display the newest year first.
     * Preserve the order in which years appear in the document.
     */
    return years.slice(0, 5);
  }

  /* ---------------------------------------------------------
     Alias matching
     --------------------------------------------------------- */

  function aliasMatchScore(line, alias) {
    const lowerLine = line.toLowerCase();
    const lowerAlias = alias.toLowerCase();

    if (!lowerLine.includes(lowerAlias)) {
      return 0;
    }

    let score = 50;

    if (
      lowerLine.trim().startsWith(lowerAlias)
    ) {
      score += 25;
    }

    if (
      lowerLine === lowerAlias
    ) {
      score += 20;
    }

    if (
      new RegExp(
        `^${escapeRegExp(lowerAlias)}(?:\\s|$)`,
        "i"
      ).test(lowerLine)
    ) {
      score += 10;
    }

    return score;
  }

  function containsAny(line, aliases) {
    const lower = line.toLowerCase();

    return aliases.some(alias =>
      lower.includes(alias.toLowerCase())
    );
  }

  /* ---------------------------------------------------------
     Statement detection
     --------------------------------------------------------- */

  function statementContext(lines, index) {
    const start = Math.max(0, index - 15);
    const context = lines
      .slice(start, index + 1)
      .join(" ")
      .toLowerCase();

    if (
      /balance sheet|consolidated balance sheets|financial position/.test(context)
    ) {
      return "balance_sheet";
    }

    if (
      /income statement|statements of operations|statements of income|operations and comprehensive income/.test(context)
    ) {
      return "income_statement";
    }

    if (
      /cash flows|statement of cash flows/.test(context)
    ) {
      return "cash_flow";
    }

    return "unknown";
  }

  function expectedStatement(concept) {
    if (
      ["currentAssets", "currentLiabilities", "shortTermDebt",
       "longTermDebt", "totalDebt", "equity"].includes(concept)
    ) {
      return "balance_sheet";
    }

    if (
      ["revenue", "costOfRevenue", "grossProfit", "netIncome"].includes(concept)
    ) {
      return "income_statement";
    }

    if (concept === "operatingCashFlow") {
      return "cash_flow";
    }

    return "unknown";
  }

  /* ---------------------------------------------------------
     Candidate extraction
     --------------------------------------------------------- */

  function findConceptCandidates(lines, concept) {
    const aliases = ALIASES[concept] || [];
    const candidates = [];

    lines.forEach((line, index) => {
      let bestAliasScore = 0;
      let matchedAlias = null;

      aliases.forEach(alias => {
        const score = aliasMatchScore(line, alias);

        if (score > bestAliasScore) {
          bestAliasScore = score;
          matchedAlias = alias;
        }
      });

      if (!matchedAlias) return;

      const numbers = extractNumberCandidates(line);

      /*
       * If the label line itself contains no values, inspect the next
       * few lines. PDF extraction sometimes separates labels and values.
       */
      const nearbyLines = lines.slice(
        index,
        Math.min(lines.length, index + 4)
      );

      const allNumbers = [];

      nearbyLines.forEach((nearLine, offset) => {
        extractNumberCandidates(nearLine).forEach(item => {
          allNumbers.push({
            ...item,
            lineOffset: offset
          });
        });
      });

      const usableNumbers = allNumbers.filter(item => {
        const lower = nearbyLines[item.lineOffset].toLowerCase();

        if (/%/.test(lower)) return false;

        if (
          /per share|basic earnings|diluted earnings|eps/.test(lower) &&
          concept !== "netIncome"
        ) {
          return false;
        }

        return true;
      });

      const years = findYearContext(lines, index);

      const scale = nearbyScale(lines, index);

      const statement = statementContext(lines, index);
      const expected = expectedStatement(concept);

      let score = bestAliasScore;

      if (statement === expected) {
        score += 30;
      }

      if (numbers.length) {
        score += 15;
      }

      if (years.length >= 2) {
        score += 10;
      }

      if (
        statement === "unknown" &&
        expected !== "unknown"
      ) {
        score -= 5;
      }

      if (
        /total|net|gross/i.test(matchedAlias)
      ) {
        score += 3;
      }

      candidates.push({
        concept,
        index,
        line,
        alias: matchedAlias,
        score,
        statement,
        years,
        scale,
        numbers: usableNumbers.slice(0, 6)
      });
    });

    return candidates.sort(
      (a, b) => b.score - a.score
    );
  }

  /* ---------------------------------------------------------
     Candidate selection
     --------------------------------------------------------- */

  function selectBestCandidate(candidates) {
    if (!candidates.length) {
      return null;
    }

    /*
     * Prefer a candidate that actually has numbers.
     */
    const withNumbers = candidates.filter(
      candidate => candidate.numbers.length
    );

    if (withNumbers.length) {
      return withNumbers[0];
    }

    return candidates[0];
  }

  function buildObservations(candidate) {
    if (!candidate) return [];

    const values = candidate.numbers.map(
      item => item.value * candidate.scale.multiplier
    );

    if (!values.length) {
      return [];
    }

    let years = candidate.years.slice();

    /*
     * We need at least as many years as values.
     * If the surrounding context contains too many years, use the
     * most recent matching number of years.
     */
    if (years.length > values.length) {
      years = years.slice(0, values.length);
    }

    /*
     * If there are more values than identifiable years, retain the
     * values but mark years as unknown.
     */
    return values.map((value, index) => ({
      value,
      year: years[index] || null,
      rawValue: candidate.numbers[index].raw,
      scale: candidate.scale.label,
      line: candidate.line,
      page: detectPageNumber(candidate.line),
      confidence:
        candidate.score >= 100
          ? "high"
          : candidate.score >= 75
            ? "medium"
            : "low"
    }));
  }

  function detectPageNumber(line) {
    const match = String(line || "").match(
      /PAGE\s+(\d+)/i
    );

    return match ? Number(match[1]) : null;
  }

  /* ---------------------------------------------------------
     Page-aware candidate search
     --------------------------------------------------------- */

  function addPageMarkers(lines) {
    let currentPage = null;

    return lines.map(line => {
      const pageMatch = line.match(
        /^---\s*PAGE\s+(\d+)\s*---$/i
      );

      if (pageMatch) {
        currentPage = Number(pageMatch[1]);
      }

      return {
        text: line,
        page: currentPage
      };
    });
  }

  /* ---------------------------------------------------------
     Financial extraction
     --------------------------------------------------------- */

  function extractFinancialData(text) {
    const lines = getLines(text);

    const concepts = {};

    Object.keys(ALIASES).forEach(concept => {
      const candidates = findConceptCandidates(lines, concept);
      const best = selectBestCandidate(candidates);

      concepts[concept] = {
        candidates,
        best,
        observations: buildObservations(best)
      };
    });

    return {
      lines,
      concepts
    };
  }

  /* ---------------------------------------------------------
     Observation selection
     --------------------------------------------------------- */

  function sortObservations(observations) {
    return observations
      .filter(item => Number.isFinite(item.value))
      .sort((a, b) => {
        if (
          Number.isFinite(a.year) &&
          Number.isFinite(b.year)
        ) {
          return b.year - a.year;
        }

        if (Number.isFinite(a.year)) return -1;
        if (Number.isFinite(b.year)) return 1;

        return 0;
      });
  }

  function latestObservation(data) {
    const observations = sortObservations(
      data?.observations || []
    );

    return observations[0] || null;
  }

  function previousObservation(data) {
    const observations = sortObservations(
      data?.observations || []
    );

    return observations[1] || null;
  }

  function getValue(data) {
    const latest = latestObservation(data);

    return latest ? latest.value : null;
  }

  function getYear(data) {
    const latest = latestObservation(data);

    return latest ? latest.year : null;
  }

  function changePercent(current, previous) {
    if (
      !Number.isFinite(current) ||
      !Number.isFinite(previous) ||
      previous === 0
    ) {
      return null;
    }

    return ((current - previous) / Math.abs(previous)) * 100;
  }

  /* ---------------------------------------------------------
     Derived calculations
     --------------------------------------------------------- */

  function deriveGrossProfit(financials) {
    const explicit = financials.grossProfit;

    if (getValue(explicit) !== null) {
      return {
        value: getValue(explicit),
        year: getYear(explicit),
        basis: "reported",
        formula: null,
        confidence: latestObservation(explicit)?.confidence || "medium"
      };
    }

    const revenue = getValue(financials.revenue);
    const cost = getValue(financials.costOfRevenue);

    if (
      Number.isFinite(revenue) &&
      Number.isFinite(cost)
    ) {
      return {
        value: revenue - cost,
        year: getYear(financials.revenue),
        basis: "calculated",
        formula: "Revenue − Cost of revenue",
        confidence: "medium"
      };
    }

    return {
      value: null,
      year: null,
      basis: "not_available",
      formula: null,
      confidence: "low"
    };
  }

  function deriveCurrentRatio(financials) {
    const assets = getValue(financials.currentAssets);
    const liabilities = getValue(financials.currentLiabilities);

    if (
      Number.isFinite(assets) &&
      Number.isFinite(liabilities) &&
      liabilities !== 0
    ) {
      return {
        value: assets / liabilities,
        year: getYear(financials.currentAssets),
        basis: "calculated",
        formula: "Current assets ÷ Current liabilities"
      };
    }

    return {
      value: null,
      year: null,
      basis: "not_available",
      formula: null
    };
  }

  function deriveDebt(financials) {
    const explicit = getValue(financials.totalDebt);

    if (Number.isFinite(explicit)) {
      return {
        value: explicit,
        year: getYear(financials.totalDebt),
        basis: "reported",
        formula: null
      };
    }

    const shortTerm = getValue(financials.shortTermDebt);
    const longTerm = getValue(financials.longTermDebt);

    if (
      Number.isFinite(shortTerm) ||
      Number.isFinite(longTerm)
    ) {
      return {
        value:
          (Number.isFinite(shortTerm) ? shortTerm : 0) +
          (Number.isFinite(longTerm) ? longTerm : 0),
        year:
          getYear(financials.longTermDebt) ||
          getYear(financials.shortTermDebt),
        basis: "calculated",
        formula: "Short-term debt + Long-term debt"
      };
    }

    return {
      value: null,
      year: null,
      basis: "not_available",
      formula: null
    };
  }

  function deriveDebtToEquity(financials) {
    const debt = deriveDebt(financials);
    const equity = getValue(financials.equity);

    if (
      Number.isFinite(debt.value) &&
      Number.isFinite(equity) &&
      equity !== 0
    ) {
      return {
        value: debt.value / equity.value,
        year: debt.year || getYear(financials.equity),
        basis: "calculated",
        formula: "Total debt ÷ Shareholders' equity"
      };
    }

    return {
      value: null,
      year: null,
      basis: "not_available",
      formula: null
    };
  }

  function deriveMargins(financials) {
    const revenue = getValue(financials.revenue);
    const gross = deriveGrossProfit(financials);
    const net = getValue(financials.netIncome);

    return {
      grossMargin:
        Number.isFinite(revenue) &&
        revenue !== 0 &&
        Number.isFinite(gross.value)
          ? (gross.value / revenue) * 100
          : null,

      netMargin:
        Number.isFinite(revenue) &&
        revenue !== 0 &&
        Number.isFinite(net)
          ? (net / revenue) * 100
          : null
    };
  }

  /* ---------------------------------------------------------
     Trend calculations
     --------------------------------------------------------- */

  function trendForConcept(data) {
    const observations = sortObservations(
      data?.observations || []
    );

    if (observations.length < 2) {
      return {
        current: observations[0]?.value ?? null,
        previous: null,
        currentYear: observations[0]?.year ?? null,
        previousYear: null,
        changePercent: null,
        direction: "not_available"
      };
    }

    const current = observations[0];
    const previous = observations[1];

    const change = changePercent(
      current.value,
      previous.value
    );

    return {
      current: current.value,
      previous: previous.value,
      currentYear: current.year,
      previousYear: previous.year,
      changePercent: change,
      direction:
        change === null
          ? "not_available"
          : change > 0.5
            ? "up"
            : change < -0.5
              ? "down"
              : "flat"
    };
  }

  /* ---------------------------------------------------------
     Risk indicators
     --------------------------------------------------------- */

  function createRiskIndicators(financials, derived) {
    const indicators = [];

    const currentRatio = derived.currentRatio.value;

    if (Number.isFinite(currentRatio)) {
      let status = "neutral";
      let explanation =
        "Current assets and current liabilities were identified and used to calculate the current ratio.";

      if (currentRatio < 1) {
        status = "attention";
        explanation =
          "Current liabilities exceed current assets based on the extracted figures. This indicates tighter short-term liquidity and should be examined alongside cash flows, debt maturities and available financing.";
      } else if (currentRatio >= 1.5) {
        status = "positive";
        explanation =
          "Current assets exceed current liabilities with a current ratio above 1.5. This provides more short-term asset coverage, although the composition and liquidity of those assets still matter.";
      } else {
        status = "neutral";
        explanation =
          "Current assets exceed current liabilities, but the ratio does not by itself establish financial strength or weakness.";
      }

      indicators.push({
        title: "Liquidity",
        status,
        value: currentRatio,
        formattedValue: `${round(currentRatio, 2)}x`,
        explanation
      });
    } else {
      indicators.push({
        title: "Liquidity",
        status: "not_available",
        value: null,
        formattedValue: "Not found",
        explanation:
          "Current assets and/or current liabilities could not be reliably extracted."
      });
    }

    const debtEquity = derived.debtToEquity.value;

    if (Number.isFinite(debtEquity)) {
      indicators.push({
        title: "Leverage",
        status:
          debtEquity > 2
            ? "attention"
            : debtEquity > 1
              ? "neutral"
              : "positive",
        value: debtEquity,
        formattedValue: `${round(debtEquity, 2)}x`,
        explanation:
          "Debt-to-equity compares extracted debt with shareholders' equity. A higher ratio indicates greater debt relative to the company's equity base; interpretation depends heavily on the company's industry and capital structure."
      });
    } else {
      indicators.push({
        title: "Leverage",
        status: "not_available",
        value: null,
        formattedValue: "Not found",
        explanation:
          "Debt and/or shareholders' equity could not be reliably extracted."
      });
    }

    const revenueTrend = trendForConcept(financials.revenue);

    indicators.push({
      title: "Revenue trend",
      status:
        revenueTrend.direction === "up"
          ? "positive"
          : revenueTrend.direction === "down"
            ? "attention"
            : revenueTrend.direction === "flat"
              ? "neutral"
              : "not_available",
      value: revenueTrend.changePercent,
      formattedValue:
        revenueTrend.changePercent === null
          ? "Not available"
          : `${revenueTrend.changePercent >= 0 ? "+" : ""}${round(revenueTrend.changePercent, 1)}%`,
      explanation:
        revenueTrend.changePercent === null
          ? "At least two comparable annual revenue observations were not identified."
          : `Revenue changed ${revenueTrend.changePercent >= 0 ? "by an increase" : "by a decrease"} of ${Math.abs(round(revenueTrend.changePercent, 1))}% between the two most recent extracted periods.`
    });

    const netTrend = trendForConcept(financials.netIncome);

    indicators.push({
      title: "Profitability trend",
      status:
        netTrend.direction === "up"
          ? "positive"
          : netTrend.direction === "down"
            ? "attention"
            : netTrend.direction === "flat"
              ? "neutral"
              : "not_available",
      value: netTrend.changePercent,
      formattedValue:
        netTrend.changePercent === null
          ? "Not available"
          : `${netTrend.changePercent >= 0 ? "+" : ""}${round(netTrend.changePercent, 1)}%`,
      explanation:
        netTrend.changePercent === null
          ? "Two comparable annual net-income observations were not identified."
          : `Net profit changed ${netTrend.changePercent >= 0 ? "by an increase" : "by a decrease"} of ${Math.abs(round(netTrend.changePercent, 1))}% between the two most recent extracted periods.`
    });

    const ocf = getValue(financials.operatingCashFlow);
    const netIncome = getValue(financials.netIncome);

    if (
      Number.isFinite(ocf) &&
      Number.isFinite(netIncome) &&
      netIncome !== 0
    ) {
      const cashConversion =
        (ocf / netIncome) * 100;

      indicators.push({
        title: "Cash conversion",
        status:
          cashConversion < 80
            ? "attention"
            : "positive",
        value: cashConversion,
        formattedValue: `${round(cashConversion, 1)}%`,
        explanation:
          "Operating cash flow is compared with net profit as a simple cash-conversion indicator. It should be interpreted with working-capital movements and non-cash items in mind."
      });
    } else {
      indicators.push({
        title: "Cash conversion",
        status: "not_available",
        value: null,
        formattedValue: "Not available",
        explanation:
          "Operating cash flow and net profit were not both available for the latest comparable period."
      });
    }

    return indicators;
  }

  /* ---------------------------------------------------------
     Going concern analysis
     --------------------------------------------------------- */

  function analyzeGoingConcern(text) {
    const source = String(text || "");

    const explicitPatterns = [
      /substantial doubt about (?:the )?(?:company's|our) ability to continue as a going concern/i,
      /substantial doubt .* going concern/i,
      /going concern/i
    ];

    const seriousPatterns = [
      /material uncertainty/i,
      /liquidity (?:and )?capital resources/i,
      /default(?:ed|s)? on (?:our|its) debt/i,
      /debt covenant/i,
      /covenant violation/i,
      /recurring losses/i,
      /negative cash flows from operating activities/i,
      /substantial operating losses/i,
      /ability to meet .* obligations/i
    ];

    const explicitMatches = [];
    const seriousMatches = [];

    explicitPatterns.forEach(pattern => {
      const match = source.match(pattern);

      if (match) {
        explicitMatches.push(match[0]);
      }
    });

    seriousPatterns.forEach(pattern => {
      const match = source.match(pattern);

      if (match) {
        seriousMatches.push(match[0]);
      }
    });

    if (
      /substantial doubt .* going concern/i.test(source) ||
      /substantial doubt about .* ability to continue/i.test(source)
    ) {
      return {
        status: "explicit_concern",
        label: "Explicit going-concern concern detected",
        explanation:
          "The uploaded document contains language indicating substantial doubt about the company's ability to continue as a going concern.",
        evidence: extractEvidence(
          source,
          /substantial doubt .* going concern/i
        )
      };
    }

    if (explicitMatches.length || seriousMatches.length) {
      return {
        status: "disclosure_detected",
        label: "Related liquidity / going-concern disclosure detected",
        explanation:
          "The document contains disclosures related to going concern, liquidity, financing, covenants or other conditions that may require further review. This is not, by itself, a conclusion that the company cannot continue operating.",
        evidence: extractEvidence(
          source,
          /going concern|material uncertainty|liquidity|debt covenant|covenant violation|recurring losses|negative cash flows/i
        )
      };
    }

    return {
      status: "not_detected",
      label: "No explicit going-concern disclosure detected",
      explanation:
        "Forge did not identify an explicit going-concern disclosure in the extracted text. Absence of the phrase does not establish that no financial or liquidity risk exists.",
      evidence: null
    };
  }

  function extractEvidence(text, pattern) {
    const match = String(text).match(pattern);

    if (!match || match.index === undefined) {
      return null;
    }

    const start = Math.max(0, match.index - 180);
    const end = Math.min(
      text.length,
      match.index + match[0].length + 300
    );

    return cleanText(
      text.slice(start, end)
    );
  }

  /* ---------------------------------------------------------
     Investor brief
     --------------------------------------------------------- */

  function buildInvestorBrief(financials, derived, document) {
    const insights = [];

    const revenueTrend = trendForConcept(
      financials.revenue
    );

    if (revenueTrend.changePercent !== null) {
      insights.push({
        type: "revenue",
        title: "Revenue movement",
        text:
          `Revenue changed ${revenueTrend.changePercent >= 0 ? "up" : "down"} ${Math.abs(round(revenueTrend.changePercent, 1))}% from ${revenueTrend.previousYear || "the prior period"} to ${revenueTrend.currentYear || "the latest period"}.`
      });
    }

    const gross = derived.grossProfit;
    const revenue = getValue(financials.revenue);

    if (
      Number.isFinite(gross.value) &&
      Number.isFinite(revenue) &&
      revenue !== 0
    ) {
      const margin =
        (gross.value / revenue) * 100;

      insights.push({
        type: "gross_margin",
        title: "Gross profitability",
        text:
          `Gross profit was ${formatAmount(gross.value)}${gross.basis === "calculated" ? " and was calculated from revenue less cost of revenue" : ""}. The resulting gross margin is ${round(margin, 1)}%.`
      });
    }

    const net = getValue(financials.netIncome);

    if (
      Number.isFinite(net) &&
      Number.isFinite(revenue) &&
      revenue !== 0
    ) {
      const margin =
        (net / revenue) * 100;

      insights.push({
        type: "net_margin",
        title: "Net profitability",
        text:
          `Net profit was ${formatAmount(net)}, representing a net margin of ${round(margin, 1)}% of revenue.`
      });
    }

    const currentRatio =
      derived.currentRatio.value;

    if (Number.isFinite(currentRatio)) {
      insights.push({
        type: "liquidity",
        title: "Short-term liquidity",
        text:
          `The latest extracted current ratio is ${round(currentRatio, 2)}x, based on current assets of ${formatAmount(getValue(financials.currentAssets))} and current liabilities of ${formatAmount(getValue(financials.currentLiabilities))}.`
      });
    }

    const debtEquity =
      derived.debtToEquity.value;

    if (Number.isFinite(debtEquity)) {
      insights.push({
        type: "leverage",
        title: "Debt relative to equity",
        text:
          `Debt-to-equity is approximately ${round(debtEquity, 2)}x using the extracted debt and shareholders' equity figures.`
      });
    }

    const ocf =
      getValue(financials.operatingCashFlow);

    if (Number.isFinite(ocf)) {
      insights.push({
        type: "cashflow",
        title: "Operating cash generation",
        text:
          `Operating cash flow was ${formatAmount(ocf)} in the latest identified period.`
      });
    }

    if (
      Number.isFinite(ocf) &&
      Number.isFinite(net) &&
      net !== 0
    ) {
      const ratio =
        (ocf / net) * 100;

      insights.push({
        type: "cash_conversion",
        title: "Cash versus accounting profit",
        text:
          `Operating cash flow was approximately ${round(ratio, 1)}% of net profit, providing a useful indication of how accounting earnings translated into operating cash.`
      });
    }

    const debt = deriveDebt(financials);

    if (Number.isFinite(debt.value)) {
      insights.push({
        type: "debt",
        title: "Debt position",
        text:
          `The latest identified debt figure is ${formatAmount(debt.value)} (${debt.basis}).`
      });
    }

    if (
      document.fiscalYears &&
      document.fiscalYears.length
    ) {
      insights.push({
        type: "period",
        title: "Reporting period",
        text:
          `The document contains financial information for fiscal years including ${document.fiscalYears.slice(0, 3).join(", ")}.`
      });
    }

    /*
     * Do not fabricate ten insights. Only include evidence-backed
     * information. The UI can clearly show fewer than ten when data
     * is insufficient.
     */
    return insights.slice(0, 10);
  }

  /* ---------------------------------------------------------
     Statistics
     * --------------------------------------------------------- */

  function buildStatistics(financials, derived) {
    const statistics = [];

    const revenueTrend =
      trendForConcept(financials.revenue);

    statistics.push({
      label: "Revenue",
      value: getValue(financials.revenue),
      change: revenueTrend.changePercent,
      year: getYear(financials.revenue),
      basis: "reported"
    });

    statistics.push({
      label: "Gross profit",
      value: derived.grossProfit.value,
      change: null,
      year: derived.grossProfit.year,
      basis: derived.grossProfit.basis
    });

    statistics.push({
      label: "Net profit",
      value: getValue(financials.netIncome),
      change: trendForConcept(financials.netIncome).changePercent,
      year: getYear(financials.netIncome),
      basis: "reported"
    });

    statistics.push({
      label: "Current ratio",
      value: derived.currentRatio.value,
      change: null,
      year: derived.currentRatio.year,
      basis: derived.currentRatio.basis
    });

    statistics.push({
      label: "Debt to equity",
      value: derived.debtToEquity.value,
      change: null,
      year: derived.debtToEquity.year,
      basis: derived.debtToEquity.basis
    });

    statistics.push({
      label: "Operating cash flow",
      value: getValue(financials.operatingCashFlow),
      change: trendForConcept(financials.operatingCashFlow).changePercent,
      year: getYear(financials.operatingCashFlow),
      basis: "reported"
    });

    return statistics;
  }

  /* ---------------------------------------------------------
     Financial table
     --------------------------------------------------------- */

  function buildFinancialTable(financials, derived) {
    const rows = [];

    function add(label, data, basisOverride) {
      const latest = latestObservation(data);

      rows.push({
        label,
        value: latest ? latest.value : null,
        year: latest ? latest.year : null,
        basis:
          basisOverride ||
          (latest ? "reported" : "not_available"),
        source:
          latest?.line || null
      });
    }

    add("Revenue", financials.revenue);
    add(
      "Gross profit",
      financials.grossProfit,
      derived.grossProfit.basis
    );

    if (
      !getValue(financials.grossProfit) &&
      Number.isFinite(derived.grossProfit.value)
    ) {
      rows[rows.length - 1].source =
        derived.grossProfit.formula;
    }

    add("Net profit", financials.netIncome);
    add("Current assets", financials.currentAssets);
    add("Current liabilities", financials.currentLiabilities);
    add(
      "Current ratio",
      {
        observations: derived.currentRatio.value !== null
          ? [{
              value: derived.currentRatio.value,
              year: derived.currentRatio.year
            }]
          : []
      },
      derived.currentRatio.basis
    );

    add(
      "Debt to equity",
      {
        observations: derived.debtToEquity.value !== null
          ? [{
              value: derived.debtToEquity.value,
              year: derived.debtToEquity.year
            }]
          : []
      },
      derived.debtToEquity.basis
    );

    add("Operating cash flow", financials.operatingCashFlow);

    return rows;
  }

  /* ---------------------------------------------------------
     Amount formatting
     --------------------------------------------------------- */

  function formatAmount(value) {
    if (!Number.isFinite(value)) {
      return "Not available";
    }

    const absolute = Math.abs(value);
    let formatted;

    if (absolute >= 1e12) {
      formatted = `${round(value / 1e12, 2)} trillion`;
    } else if (absolute >= 1e9) {
      formatted = `${round(value / 1e9, 2)} billion`;
    } else if (absolute >= 1e6) {
      formatted = `${round(value / 1e6, 2)} million`;
    } else if (absolute >= 1e3) {
      formatted = `${round(value / 1e3, 2)} thousand`;
    } else {
      formatted = `${round(value, 2)}`;
    }

    return formatted;
  }

  /* ---------------------------------------------------------
     Quality checks
     --------------------------------------------------------- */

  function qualityCheck(document, financials, derived) {
    const warnings = [];

    if (!document.is10K && !document.isAnnualReport) {
      warnings.push(
        "The uploaded file does not clearly identify itself as a Form 10-K or annual report."
      );
    }

    if (!Number.isFinite(getValue(financials.revenue))) {
      warnings.push(
        "Revenue could not be reliably extracted."
      );
    }

    if (!Number.isFinite(getValue(financials.netIncome))) {
      warnings.push(
        "Net profit could not be reliably extracted."
      );
    }

    if (!Number.isFinite(derived.currentRatio.value)) {
      warnings.push(
        "Current ratio could not be calculated because current assets and/or current liabilities were not reliably extracted."
      );
    }

    if (!Number.isFinite(derived.debtToEquity.value)) {
      warnings.push(
        "Debt-to-equity could not be calculated because debt and/or equity data was not reliably extracted."
      );
    }

    if (!Number.isFinite(getValue(financials.operatingCashFlow))) {
      warnings.push(
        "Operating cash flow could not be reliably extracted."
      );
    }

    return unique(warnings);
  }

  /* ---------------------------------------------------------
     Main analysis function
     --------------------------------------------------------- */

  async function analyzeFile(file, options = {}) {
    const onProgress = options.onProgress;

    emitProgress(
      onProgress,
      1,
      "Preparing analysis",
      "Validating uploaded document"
    );

    await sleep(120);

    const extracted = await extractFile(
      file,
      onProgress
    );

    emitProgress(
      onProgress,
      38,
      "Normalizing document",
      "Preparing extracted financial text"
    );

    await sleep(150);

    const normalizedText =
      normalizeFinancialText(extracted.text);

    if (normalizedText.length < 500) {
      throw new Error(
        "Forge could not extract enough readable text from this document."
      );
    }

    emitProgress(
      onProgress,
      45,
      "Locating financial statements",
      "Searching for annual financial data"
    );

    await sleep(180);

    const document = detectDocument(
      normalizedText,
      file.name
    );

    emitProgress(
      onProgress,
      55,
      "Extracting financial values",
      "Matching reported financial statement line items"
    );

    const extractedFinancials =
      extractFinancialData(normalizedText);

    emitProgress(
      onProgress,
      66,
      "Calculating metrics",
      "Calculating ratios and derived figures"
    );

    await sleep(180);

    const financials =
      extractedFinancials.concepts;

    const grossProfit =
      deriveGrossProfit(financials);

    const currentRatio =
      deriveCurrentRatio(financials);

    const debt =
      deriveDebt(financials);

    const debtToEquity =
      deriveDebtToEquity(financials);

    const margins =
      deriveMargins(financials);

    const derived = {
      grossProfit,
      currentRatio,
      debt,
      debtToEquity,
      margins
    };

    emitProgress(
      onProgress,
      75,
      "Checking risk indicators",
      "Reviewing liquidity, leverage, profitability and cash conversion"
    );

    await sleep(180);

    const riskIndicators =
      createRiskIndicators(
        financials,
        derived
      );

    emitProgress(
      onProgress,
      83,
      "Reviewing going-concern disclosures",
      "Searching the filing for relevant disclosures"
    );

    await sleep(180);

    const goingConcern =
      analyzeGoingConcern(normalizedText);

    emitProgress(
      onProgress,
      90,
      "Building investor brief",
      "Converting extracted facts into an investor-focused summary"
    );

    await sleep(180);

    const investorBrief =
      buildInvestorBrief(
        financials,
        derived,
        document
      );

    const statistics =
      buildStatistics(
        financials,
        derived
      );

    const financialTable =
      buildFinancialTable(
        financials,
        derived
      );

    const warnings =
      qualityCheck(
        document,
        financials,
        derived
      );

    emitProgress(
      onProgress,
      96,
      "Finalizing analysis",
      "Checking output consistency"
    );

    await sleep(220);

    const result = {
      success: true,

      document: {
        fileName: file.name,
        fileType: extracted.type,
        fileSize: file.size,
        pages: extracted.pages,
        extractedCharacters: normalizedText.length,
        companyName: document.companyName,
        is10K: document.is10K,
        isAnnualReport: document.isAnnualReport,
        fiscalYears: document.fiscalYears
      },

      metrics: {
        revenue: {
          value: getValue(financials.revenue),
          year: getYear(financials.revenue),
          basis: "reported",
          trend: trendForConcept(financials.revenue)
        },

        grossProfit: {
          value: grossProfit.value,
          year: grossProfit.year,
          basis: grossProfit.basis,
          formula: grossProfit.formula,
          confidence: grossProfit.confidence
        },

        netProfit: {
          value: getValue(financials.netIncome),
          year: getYear(financials.netIncome),
          basis: "reported",
          trend: trendForConcept(financials.netIncome)
        },

        currentRatio: {
          value: currentRatio.value,
          year: currentRatio.year,
          basis: currentRatio.basis,
          formula: currentRatio.formula
        },

        debtToEquity: {
          value: debtToEquity.value,
          year: debtToEquity.year,
          basis: debtToEquity.basis,
          formula: debtToEquity.formula
        },

        operatingCashFlow: {
          value: getValue(financials.operatingCashFlow),
          year: getYear(financials.operatingCashFlow),
          basis: "reported",
          trend: trendForConcept(
            financials.operatingCashFlow
          )
        }
      },

      underlyingFinancials: {
        revenue: financials.revenue.observations,
        costOfRevenue: financials.costOfRevenue.observations,
        grossProfit: financials.grossProfit.observations,
        netIncome: financials.netIncome.observations,
        currentAssets: financials.currentAssets.observations,
        currentLiabilities: financials.currentLiabilities.observations,
        shortTermDebt: financials.shortTermDebt.observations,
        longTermDebt: financials.longTermDebt.observations,
        totalDebt: financials.totalDebt.observations,
        equity: financials.equity.observations,
        operatingCashFlow:
          financials.operatingCashFlow.observations
      },

      statistics,

      financialTable,

      riskIndicators,

      goingConcern,

      investorBrief,

      warnings,

      methodology: {
        engine:
          "Deterministic browser-based financial document analysis",
        reportedValues:
          "Values explicitly identified in the uploaded document are labelled as reported.",
        calculatedValues:
          "Derived figures are calculated from extracted financial statement values and labelled as calculated.",
        noExternalData:
          "Forge does not use live market data, SEC APIs or external company databases during this analysis.",
        limitations: [
          "Extraction accuracy depends on the structure and readability of the uploaded document.",
          "Scanned or image-only PDFs cannot be reliably interpreted without OCR.",
          "Financial statement tables with unusual layouts may require manual verification against the source filing.",
          "Ratios are analytical indicators, not investment recommendations."
        ]
      },

      source: {
        type: "uploaded_file",
        fileName: file.name
      },

      analyzedAt: new Date().toISOString()
    };

    emitProgress(
      onProgress,
      100,
      "Analysis complete",
      "Financial analysis is ready"
    );

    return result;
  }

  /* ---------------------------------------------------------
     Public API
     --------------------------------------------------------- */

  window.ForgeParser = {
    analyzeFile,
    extractFile,
    formatAmount,
    round
  };

})(window);
