import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.mjs";

const $ = (selector) => document.querySelector(selector);

const status = $("#status");
const input = $("#fileInput");
const drop = $("#dropZone");

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>\"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character]
  );

const billion = (value) =>
  Number.isFinite(value)
    ? `$${value.toLocaleString(undefined, {
        maximumFractionDigits: 2
      })}B`
    : "Not found";

const unitScale = (text) => {
  if (/\b(in|amounts in)\s+millions\b/i.test(text)) return 0.001;
  if (/\b(in|amounts in)\s+thousands\b/i.test(text)) return 0.000001;
  return 1;
};

function numbers(text) {
  return [...text.matchAll(
    /\(?\$?\s*-?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?|\(?\$?\s*-?\d+\.\d+\)?/g
  )]
    .map((match) => {
      const raw = match[0].replace(/[\s$,]/g, "");
      const number = Number(raw.replace(/[()]/g, ""));
      return /\(/.test(raw) || raw.startsWith("-") ? -number : number;
    })
    .filter(
      (value) =>
        Number.isFinite(value) &&
        !(value >= 1900 && value <= 2100)
    );
}

function extract(text) {
  const scale = unitScale(text);
  const result = {};

  for (const [key, aliases] of Object.entries(FORGE_METRICS)) {
    let found = null;

    for (const alias of aliases) {
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const match = new RegExp(escapedAlias, "ig").exec(text);

      if (!match) continue;

      const valuesAfterLabel = numbers(
        text.slice(
          match.index + match[0].length,
          match.index + match[0].length + 400
        )
      );

      const value = valuesAfterLabel[0];

      if (Number.isFinite(value)) {
        found = {
          value: value * scale,
          evidence: text
            .slice(
              Math.max(0, match.index - 120),
              match.index + match[0].length + 300
            )
            .replace(/\s+/g, " ")
            .trim(),
          alias
        };

        break;
      }
    }

    result[key] = found;
  }

  return { result, scale };
}

async function textFromPdf(file) {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer())
  }).promise;

  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();

    pages.push(
      `PAGE ${pageNumber}\n` +
        content.items.map((item) => item.str).join(" ")
    );
  }

  return pages.join("\n");
}

async function textFromFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();

  if (extension === "pdf") {
    return textFromPdf(file);
  }

  if (extension === "csv") {
    return file.text();
  }

  if (extension === "docx") {
    if (!window.mammoth) {
      throw new Error("Word reader did not load. Refresh and try again.");
    }

    const result = await window.mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer()
    });

    return result.value;
  }

  if (extension === "xlsx" || extension === "xls") {
    if (!window.XLSX) {
      throw new Error("Spreadsheet reader did not load. Refresh and try again.");
    }

    const workbook = window.XLSX.read(await file.arrayBuffer(), {
      type: "array"
    });

    return workbook.SheetNames.map(
      (sheetName) =>
        `SHEET: ${sheetName}\n` +
        window.XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])
    ).join("\n\n");
  }

  throw new Error("Use a PDF, CSV, XLSX/XLS, or DOCX file.");
}

const ratio = (top, bottom) => (top && bottom ? top / bottom : null);

const percent = (top, bottom) =>
  top && bottom ? (top / bottom) * 100 : null;

const fmt = (value, suffix = "") =>
  Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : "Not available";

function render(data) {
  const value = (key) => data[key]?.value;

  $("#metricCards").innerHTML = Object.keys(FORGE_LABELS)
    .map((key) => {
      const item = data[key];
      const id = `evidence-${key}`;

      return `
        <article>
          <span>${FORGE_LABELS[key]}</span>

          <strong class="${item ? "" : "unavailable"}">
            ${item ? billion(item.value) : "Not found"}
          </strong>

          ${
            item
              ? `<button data-target="${id}">View source evidence</button>`
              : "<small>File must include this label and a nearby number.</small>"
          }
        </article>
      `;
    })
    .join("");

  const ratios = [
    ["Current ratio", ratio(value("currentAssets"), value("currentLiabilities")), "x"],
    ["Debt / equity", ratio(value("totalDebt"), value("equity")), "x"],
    ["Gross margin", percent(value("grossProfit"), value("revenue")), "%"],
    ["Net margin", percent(value("netIncome"), value("revenue")), "%"],
    [
      "Cash conversion",
      percent(value("operatingCashFlow"), value("netIncome")),
      "%"
    ]
  ];

  $("#ratios").innerHTML = ratios
    .map(
      ([name, number, suffix]) => `
        <div class="ratio">
          <span>${name}</span>
          <strong>${fmt(number, suffix)}</strong>
        </div>
      `
    )
    .join("");

  const notes = [];

  if (value("revenue") && value("netIncome")) {
    notes.push(
      `The extracted net margin is ${fmt(
        percent(value("netIncome"), value("revenue")),
        "%"
      )}. This is calculated from the displayed values.`
    );
  }

  if (value("currentAssets") && value("currentLiabilities")) {
    notes.push(
      `The extracted current ratio is ${fmt(
        ratio(value("currentAssets"), value("currentLiabilities")),
        "x"
      )}. Below 1.00x means current liabilities exceed current assets.`
    );
  }

  if (value("netIncome") && value("operatingCashFlow")) {
    notes.push(
      `Operating cash flow is ${fmt(
        percent(value("operatingCashFlow"), value("netIncome")),
        "% of net income"
      )}. This is descriptive, not a forecast.`
    );
  }

  if (!notes.length) {
    notes.push(
      "No complete ratio could be calculated. Review evidence and use a document with standard consolidated financial statements."
    );
  }

  $("#analysis").innerHTML = notes
    .map((note) => `<p class="analysis-note">${esc(note)}</p>`)
    .join("");

  $("#evidence").innerHTML =
    Object.entries(data)
      .filter(([, item]) => item)
      .map(
        ([key, item]) => `
          <article id="evidence-${key}">
            <h3>
              ${FORGE_LABELS[key]}
              <small>matched “${esc(item.alias)}”</small>
            </h3>

            <p>${esc(item.evidence)}</p>
          </article>
        `
      )
      .join("") ||
    "<p>No standard financial-statement labels were found. Try an extracted-text PDF or a spreadsheet with labels in the first column.</p>";

  document.querySelectorAll("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .getElementById(button.dataset.target)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
    });
  });
}

async function analyse(file) {
  try {
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      throw new Error(
        "This file is larger than 50 MB. Use a smaller or text-based filing."
      );
    }

    status.textContent = "Reading file locally…";

    const text = await textFromFile(file);

    if (text.trim().length < 80) {
      throw new Error(
        "Very little readable text was found. For scanned PDFs, use a text-searchable version or OCR it first."
      );
    }

    const { result, scale } = extract(text);

    $("#fileName").textContent = file.name;

    $("#fileDetails").textContent =
      `${(file.size / 1048576).toFixed(2)} MB · ` +
      `${Object.values(result).filter(Boolean).length} of ` +
      `${Object.keys(FORGE_METRICS).length} expected metrics found · ` +
      `interpreted as ${
        scale === 0.001
          ? "millions"
          : scale === 0.000001
          ? "thousands"
          : "billions or unlabelled units"
      }.`;

    $("#results").hidden = false;

    render(result);

    status.textContent =
      "Analysis complete. Check the source evidence before using any value.";
  } catch (error) {
    console.error(error);
    status.textContent = `Could not analyse this file: ${error.message}`;
  }
}

$("#chooseFile").addEventListener("click", () => input.click());

input.addEventListener("change", () => analyse(input.files[0]));

["dragenter", "dragover"].forEach((eventName) => {
  drop.addEventListener(eventName, (event) => {
    event.preventDefault();
    drop.classList.add("drag");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  drop.addEventListener(eventName, (event) => {
    event.preventDefault();
    drop.classList.remove("drag");
  });
});

drop.addEventListener("drop", (event) => {
  analyse(event.dataTransfer.files[0]);
});

$("#newFile").addEventListener("click", () => {
  input.value = "";
  $("#results").hidden = true;
  status.textContent = "Choose another document to analyse.";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});
