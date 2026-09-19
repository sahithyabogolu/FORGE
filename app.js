/* =========================================================
   FORGE — app.js
   UI controller for the browser-based financial analyzer
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEYS = {
    userName: "forge_user_name",
    history: "forge_analysis_history",
    lastAnalysis: "forge_last_analysis"
  };

  const state = {
    userName: "",
    file: null,
    analysis: null,
    history: [],
    currentView: "dashboard"
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  /* ---------------------------------------------------------
     Initialization
     --------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    loadStoredState();
    bindEvents();
    initializeInterface();

    if (state.userName) {
      showWorkspace();
    } else {
      showWelcome();
    }
  }

  function bindEvents() {
    const nameForm = $("#nameForm");
    const nameInput = $("#nameInput");

    if (nameForm) {
      nameForm.addEventListener("submit", handleNameSubmit);
    }

    if (nameInput) {
      nameInput.addEventListener("input", () => {
        clearFieldError();
      });

      nameInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          handleNameSubmit(event);
        }
      });
    }

    const fileInput = $("#fileInput");
    const dropZone = $("#dropZone");

    if (fileInput) {
      fileInput.addEventListener("change", event => {
        const file = event.target.files?.[0];

        if (file) {
          handleFile(file);
        }
      });
    }

    if (dropZone) {
      dropZone.addEventListener("click", event => {
        if (
          event.target.closest("button") ||
          event.target.closest("input")
        ) {
          return;
        }

        fileInput?.click();
      });

      dropZone.addEventListener("dragover", event => {
        event.preventDefault();
        dropZone.classList.add("drag-active");
      });

      dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-active");
      });

      dropZone.addEventListener("drop", event => {
        event.preventDefault();
        dropZone.classList.remove("drag-active");

        const file = event.dataTransfer?.files?.[0];

        if (file) {
          handleFile(file);
        }
      });
    }

    const uploadButton = $("#uploadButton");
    if (uploadButton) {
      uploadButton.addEventListener("click", () => {
        fileInput?.click();
      });
    }

    const analyzeButton = $("#analyzeButton");
    if (analyzeButton) {
      analyzeButton.addEventListener("click", startAnalysis);
    }

    const newAnalysisButton = $("#newAnalysisButton");
    if (newAnalysisButton) {
      newAnalysisButton.addEventListener(
        "click",
        resetForNewAnalysis
      );
    }

    const retryButton = $("#retryButton");
    if (retryButton) {
      retryButton.addEventListener("click", resetForNewAnalysis);
    }

    bindNavigation();
    bindSettings();
    bindUserMenu();
    bindModalControls();
  }

  function initializeInterface() {
    setText("#workspaceUserName", state.userName || "User");
    setText("#userNameDisplay", state.userName || "User");

    updateHistoryCount();
    updateSidebarState();

    hideAllSections();
  }

  /* ---------------------------------------------------------
     Welcome screen
     --------------------------------------------------------- */

  function handleNameSubmit(event) {
    if (event) {
      event.preventDefault();
    }

    const input = $("#nameInput");

    if (!input) {
      showWorkspace();
      return;
    }

    const name = input.value.trim();

    if (!name) {
      showFieldError("Please enter your name.");
      input.focus();
      return;
    }

    if (name.length < 2) {
      showFieldError("Please enter at least 2 characters.");
      input.focus();
      return;
    }

    state.userName = name;

    localStorage.setItem(
      STORAGE_KEYS.userName,
      name
    );

    setText("#workspaceUserName", name);
    setText("#userNameDisplay", name);

    showWorkspace();
  }

  function showFieldError(message) {
    const error = $("#nameError");

    if (error) {
      error.textContent = message;
      error.classList.add("visible");
    }
  }

  function clearFieldError() {
    const error = $("#nameError");

    if (error) {
      error.textContent = "";
      error.classList.remove("visible");
    }
  }

  function showWelcome() {
    hideAllSections();

    const welcome = $("#welcomeScreen");

    if (welcome) {
      welcome.hidden = false;
      welcome.classList.add("active");
    }

    document.body.classList.add("welcome-mode");
  }

  function showWorkspace() {
    document.body.classList.remove("welcome-mode");

    const welcome = $("#welcomeScreen");
    const workspace = $("#workspaceScreen");

    if (welcome) {
      welcome.hidden = true;
      welcome.classList.remove("active");
    }

    if (workspace) {
      workspace.hidden = false;
      workspace.classList.add("active");
    }

    showUploadState();
    updateUserLabels();
  }

  /* ---------------------------------------------------------
     File upload
     --------------------------------------------------------- */

  function handleFile(file) {
    if (!file) return;

    const validation = validateFile(file);

    if (!validation.valid) {
      showError(validation.message);
      return;
    }

    state.file = file;
    state.analysis = null;

    updateUploadedFileUI(file);
    showUploadReadyState();
  }

  function validateFile(file) {
    const name = String(file.name || "");
    const extension = name.includes(".")
      ? name.split(".").pop().toLowerCase()
      : "";

    const allowed = [
      "pdf",
      "docx",
      "xlsx",
      "xls",
      "csv",
      "txt"
    ];

    if (!allowed.includes(extension)) {
      return {
        valid: false,
        message:
          "Unsupported file. Upload a PDF, DOCX, XLSX, XLS, CSV or TXT file."
      };
    }

    /*
     * Prevent accidentally selecting an enormous document that could
     * freeze the browser.
     */
    const maxSize = 75 * 1024 * 1024;

    if (file.size > maxSize) {
      return {
        valid: false,
        message:
          "This file is larger than 75 MB. Please upload a smaller filing."
      };
    }

    return {
      valid: true,
      extension
    };
  }

  function updateUploadedFileUI(file) {
    const fileName =
      $("#uploadedFileName") ||
      $("#fileName");

    const fileSize =
      $("#uploadedFileSize") ||
      $("#fileSize");

    if (fileName) {
      fileName.textContent = file.name;
    }

    if (fileSize) {
      fileSize.textContent = formatFileSize(file.size);
    }

    setText("#sidebarDocument", file.name);
    setText("#topbarDocument", file.name);
  }

  function showUploadReadyState() {
    showSection("uploadSection");

    const uploadSection = $("#uploadSection");

    if (uploadSection) {
      uploadSection.classList.add("file-ready");
    }

    const analyzeButton = $("#analyzeButton");

    if (analyzeButton) {
      analyzeButton.disabled = false;
      analyzeButton.removeAttribute("aria-disabled");
    }

    const fileReady = $("#fileReady");
    if (fileReady) {
      fileReady.hidden = false;
    }

    const uploadNote = $("#uploadNote");
    if (uploadNote) {
      uploadNote.textContent =
        "File loaded. Start analysis when ready.";
    }
  }

  /* ---------------------------------------------------------
     Analysis
     --------------------------------------------------------- */

  async function startAnalysis() {
    if (!state.file) {
      showError("Please upload a financial document first.");
      return;
    }

    if (
      !window.ForgeParser ||
      typeof window.ForgeParser.analyzeFile !== "function"
    ) {
      showError(
        "The Forge analysis engine has not loaded correctly. Please refresh the page."
      );
      return;
    }

    disableAnalysisControls();

    showAnalysisState();

    resetProgressUI();

    try {
      const result =
        await window.ForgeParser.analyzeFile(
          state.file,
          {
            onProgress: updateAnalysisProgress
          }
        );

      if (!result || !result.success) {
        throw new Error(
          "Forge could not complete the analysis."
        );
      }

      state.analysis = result;

      saveAnalysis(result);
      renderAnalysis(result);

      await wait(250);

      showResultsState();
    } catch (error) {
      console.error("FORGE analysis error:", error);

      showError(
        normalizeErrorMessage(error)
      );
    } finally {
      enableAnalysisControls();
    }
  }

  function disableAnalysisControls() {
    const analyzeButton = $("#analyzeButton");

    if (analyzeButton) {
      analyzeButton.disabled = true;
    }

    const fileInput = $("#fileInput");

    if (fileInput) {
      fileInput.disabled = true;
    }
  }

  function enableAnalysisControls() {
    const fileInput = $("#fileInput");

    if (fileInput) {
      fileInput.disabled = false;
    }
  }

  function showAnalysisState() {
    hideResults();

    showSection("analysisSection");

    const error = $("#errorSection");
    if (error) {
      error.hidden = true;
    }
  }

  function resetProgressUI() {
    updateAnalysisProgress({
      progress: 0,
      message: "Preparing analysis",
      detail: "Initializing Forge"
    });

    $$(".analysis-step").forEach(step => {
      step.classList.remove(
        "active",
        "completed",
        "done"
      );

      const status =
        step.querySelector(".step-status");

      if (status) {
        status.textContent = "";
      }
    });
  }

  function updateAnalysisProgress(payload) {
    const progress = Number(payload?.progress || 0);
    const message = payload?.message || "Analyzing";
    const detail = payload?.detail || "";

    const bar =
      $("#progressBar");

    if (bar) {
      bar.style.width =
        `${Math.max(0, Math.min(100, progress))}%`;

      bar.setAttribute(
        "aria-valuenow",
        String(progress)
      );
    }

    setText(
      "#progressPercent",
      `${Math.round(progress)}%`
    );

    setText(
      "#progressMessage",
      message
    );

    setText(
      "#progressDetail",
      detail
    );

    updateAnalysisSteps(
      progress,
      message
    );
  }

  function updateAnalysisSteps(progress, message) {
    const steps = $$(".analysis-step");

    if (!steps.length) return;

    const messageLower =
      String(message || "").toLowerCase();

    let activeIndex = -1;

    if (messageLower.includes("preparing")) {
      activeIndex = 0;
    } else if (
      messageLower.includes("reading") ||
      messageLower.includes("extracting")
    ) {
      activeIndex = 1;
    } else if (
      messageLower.includes("normalizing") ||
      messageLower.includes("locating")
    ) {
      activeIndex = 2;
    } else if (
      messageLower.includes("calculating")
    ) {
      activeIndex = 3;
    } else if (
      messageLower.includes("risk")
    ) {
      activeIndex = 4;
    } else if (
      messageLower.includes("going-concern") ||
      messageLower.includes("going concern")
    ) {
      activeIndex = 5;
    } else if (
      messageLower.includes("investor")
    ) {
      activeIndex = 6;
    } else if (
      messageLower.includes("final")
    ) {
      activeIndex = 7;
    }

    if (activeIndex === -1) {
      activeIndex = Math.min(
        steps.length - 1,
        Math.floor(progress / 100 * steps.length)
      );
    }

    steps.forEach((step, index) => {
      step.classList.remove(
        "active",
        "completed",
        "done"
      );

      const status =
        step.querySelector(".step-status");

      if (index < activeIndex) {
        step.classList.add("completed");

        if (status) {
          status.textContent = "✓";
        }
      } else if (index === activeIndex) {
        step.classList.add("active");

        if (status) {
          status.textContent = "•";
        }
      } else if (status) {
        status.textContent = "";
      }
    });
  }

  /* ---------------------------------------------------------
     Render complete analysis
     --------------------------------------------------------- */

  function renderAnalysis(result) {
    renderDocumentHeader(result);
    renderMetrics(result);
    renderDashboard(result);
    renderRisk(result);
    renderGoingConcern(result);
    renderInvestorBrief(result);
    renderFinancialTable(result);
    renderMethodology(result);
    renderWarnings(result);
  }

  /* ---------------------------------------------------------
     Header
     --------------------------------------------------------- */

  function renderDocumentHeader(result) {
    const document = result.document || {};

    setText(
      "#resultCompanyName",
      document.companyName || "Uploaded company"
    );

    setText(
      "#resultFileName",
      document.fileName || "Uploaded document"
    );

    const years = document.fiscalYears || [];

    setText(
      "#resultPeriod",
      years.length
        ? `Fiscal years identified: ${years.slice(0, 3).join(", ")}`
        : "Fiscal period not clearly identified"
    );

    setText(
      "#resultStatus",
      document.is10K
        ? "10-K detected"
        : document.isAnnualReport
          ? "Annual report detected"
          : "Document analyzed"
    );

    setText(
      "#sidebarCompany",
      document.companyName || "Uploaded company"
    );

    setText(
      "#sidebarPeriod",
      years.length
        ? String(years[0])
        : "—"
    );
  }

  /* ---------------------------------------------------------
     Metric cards
     --------------------------------------------------------- */

  function renderMetrics(result) {
    const metrics = result.metrics || {};

    renderMetric(
      "revenue",
      metrics.revenue,
      "amount"
    );

    renderMetric(
      "grossProfit",
      metrics.grossProfit,
      "amount"
    );

    renderMetric(
      "netProfit",
      metrics.netProfit,
      "amount"
    );

    renderMetric(
      "currentRatio",
      metrics.currentRatio,
      "ratio"
    );

    renderMetric(
      "debtToEquity",
      metrics.debtToEquity,
      "ratio"
    );

    renderMetric(
      "operatingCashFlow",
      metrics.operatingCashFlow,
      "amount"
    );
  }

  function renderMetric(key, metric, type) {
    const valueElement =
      document.querySelector(
        `[data-metric-value="${key}"]`
      );

    const sourceElement =
      document.querySelector(
        `[data-metric-source="${key}"]`
      );

    const changeElement =
      document.querySelector(
        `[data-metric-change="${key}"]`
      );

    if (!valueElement) {
      /*
       * Also support conventional IDs in case the HTML uses them.
       */
      renderMetricById(
        key,
        metric,
        type
      );
      return;
    }

    const value = metric?.value;

    valueElement.textContent =
      formatMetricValue(value, type);

    if (sourceElement) {
      sourceElement.textContent =
        metric?.basis === "calculated"
          ? "Calculated"
          : value !== null && value !== undefined
            ? "Reported"
            : "Not found";
    }

    if (changeElement) {
      renderChange(
        changeElement,
        metric?.trend
      );
    }
  }

  function renderMetricById(key, metric, type) {
    const candidates = [
      `#${key}Value`,
      `#metric${capitalize(key)}`,
      `#${key}Metric`
    ];

    const valueElement =
      candidates
        .map(selector => $(selector))
        .find(Boolean);

    if (!valueElement) return;

    valueElement.textContent =
      formatMetricValue(
        metric?.value,
        type
      );
  }

  function formatMetricValue(value, type) {
    if (!Number.isFinite(value)) {
      return "Not found";
    }

    if (type === "ratio") {
      return `${round(value, 2)}x`;
    }

    return formatFinancialAmount(value);
  }

  function renderChange(element, trend) {
    if (!trend || trend.changePercent === null) {
      element.textContent = "Change unavailable";
      element.className =
        "metric-change neutral";
      return;
    }

    const change =
      Number(trend.changePercent);

    const prefix =
      change >= 0 ? "+" : "";

    element.textContent =
      `${prefix}${round(change, 1)}%`;

    element.classList.remove(
      "positive",
      "negative",
      "neutral"
    );

    element.classList.add(
      change > 0.5
        ? "positive"
        : change < -0.5
          ? "negative"
          : "neutral"
    );
  }

  /* ---------------------------------------------------------
     Dashboard
     --------------------------------------------------------- */

  function renderDashboard(result) {
    renderRevenueChart(result);
    renderDashboardRiskSummary(result);
    renderLargeStatistics(result);
  }

  function renderRevenueChart(result) {
    const chart =
      $("#revenueChart");

    const chartBars =
      $("#revenueChartBars");

    const observations =
      result.underlyingFinancials?.revenue || [];

    if (!chartBars) return;

    chartBars.innerHTML = "";

    const values =
      observations
        .filter(item =>
          Number.isFinite(item.value)
        )
        .slice(0, 5)
        .reverse();

    if (!values.length) {
      chartBars.innerHTML =
        `<div class="chart-empty">Revenue history not available.</div>`;
      return;
    }

    const max =
      Math.max(
        ...values.map(item =>
          Math.abs(item.value)
        )
      ) || 1;

    values.forEach(item => {
      const column =
        document.createElement("div");

      column.className =
        "chart-column";

      const value =
        document.createElement("div");

      value.className =
        "chart-bar-value";

      value.textContent =
        formatFinancialAmount(item.value);

      const bar =
        document.createElement("div");

      bar.className =
        "chart-bar";

      bar.style.height =
        `${Math.max(
          6,
          Math.min(
            100,
            Math.abs(item.value) / max * 100
          )
        )}%`;

      const year =
        document.createElement("div");

      year.className =
        "chart-year";

      year.textContent =
        item.year || "—";

      column.appendChild(value);
      column.appendChild(bar);
      column.appendChild(year);

      chartBars.appendChild(column);
    });

    if (chart) {
      chart.setAttribute(
        "aria-label",
        "Revenue trend chart"
      );
    }
  }

  function renderDashboardRiskSummary(result) {
    const container =
      $("#riskSummaryList");

    if (!container) return;

    container.innerHTML = "";

    const indicators =
      result.riskIndicators || [];

    if (!indicators.length) {
      container.innerHTML =
        `<div class="empty-state">No risk indicators could be calculated.</div>`;
      return;
    }

    indicators.forEach(indicator => {
      const item =
        document.createElement("div");

      item.className =
        "risk-summary-item";

      item.innerHTML = `
        <div class="risk-summary-main">
          <span class="risk-summary-title"></span>
          <span class="risk-summary-value"></span>
        </div>
        <div class="risk-summary-status"></div>
        <div class="risk-summary-reason"></div>
      `;

      item.querySelector(
        ".risk-summary-title"
      ).textContent =
        indicator.title;

      item.querySelector(
        ".risk-summary-value"
      ).textContent =
        indicator.formattedValue;

      item.querySelector(
        ".risk-summary-status"
      ).textContent =
        humanRiskStatus(indicator.status);

      item.querySelector(
        ".risk-summary-status"
      ).classList.add(
        `status-${indicator.status}`
      );

      item.querySelector(
        ".risk-summary-reason"
      ).textContent =
        indicator.explanation;

      container.appendChild(item);
    });
  }

  function renderLargeStatistics(result) {
    const container =
      $("#statisticsGrid");

    if (!container) return;

    container.innerHTML = "";

    const statistics =
      result.statistics || [];

    statistics.forEach(stat => {
      const card =
        document.createElement("div");

      card.className =
        "large-stat-panel";

      card.innerHTML = `
        <div class="large-stat-label"></div>
        <div class="large-stat"></div>
        <div class="large-stat-sub"></div>
      `;

      card.querySelector(
        ".large-stat-label"
      ).textContent =
        stat.label;

      card.querySelector(
        ".large-stat"
      ).textContent =
        formatStatistic(stat);

      card.querySelector(
        ".large-stat-sub"
      ).textContent =
        stat.year
          ? `${stat.basis === "calculated" ? "Calculated" : "Reported"} • ${stat.year}`
          : "Data unavailable";

      container.appendChild(card);
    });
  }

  function formatStatistic(stat) {
    if (!Number.isFinite(stat.value)) {
      return "Not found";
    }

    if (
      stat.label === "Current ratio" ||
      stat.label === "Debt to equity"
    ) {
      return `${round(stat.value, 2)}x`;
    }

    return formatFinancialAmount(stat.value);
  }

  /* ---------------------------------------------------------
     Risk section
     --------------------------------------------------------- */

  function renderRisk(result) {
    const container =
      $("#riskGrid");

    if (!container) return;

    container.innerHTML = "";

    const indicators =
      result.riskIndicators || [];

    indicators.forEach(indicator => {
      const card =
        document.createElement("article");

      card.className =
        "risk-card";

      card.innerHTML = `
        <div class="risk-card-header">
          <div class="risk-card-title"></div>
          <div class="risk-card-status"></div>
        </div>
        <div class="risk-card-value"></div>
        <div class="risk-card-reason"></div>
      `;

      card.querySelector(
        ".risk-card-title"
      ).textContent =
        indicator.title;

      const status =
        card.querySelector(
          ".risk-card-status"
        );

      status.textContent =
        humanRiskStatus(
          indicator.status
        );

      status.classList.add(
        `status-${indicator.status}`
      );

      card.querySelector(
        ".risk-card-value"
      ).textContent =
        indicator.formattedValue;

      card.querySelector(
        ".risk-card-reason"
      ).textContent =
        indicator.explanation;

      container.appendChild(card);
    });
  }

  function humanRiskStatus(status) {
    const map = {
      positive: "Positive indicator",
      attention: "Attention",
      neutral: "Neutral",
      not_available: "Not available"
    };

    return map[status] || "Review";
  }

  /* ---------------------------------------------------------
     Going concern
     --------------------------------------------------------- */

  function renderGoingConcern(result) {
    const going =
      result.goingConcern;

    if (!going) return;

    setText(
      "#goingConcernLabel",
      going.label
    );

    setText(
      "#goingConcernExplanation",
      going.explanation
    );

    const status =
      $("#goingConcernStatus");

    if (status) {
      status.textContent =
        going.status === "explicit_concern"
          ? "Concern detected"
          : going.status === "disclosure_detected"
            ? "Disclosure detected"
            : "No explicit disclosure detected";

      status.className =
        `going-status-value status-${going.status}`;
    }

    const evidence =
      $("#goingConcernEvidence");

    if (evidence) {
      if (going.evidence) {
        evidence.textContent =
          going.evidence;
        evidence.hidden = false;
      } else {
        evidence.textContent =
          "No matching disclosure excerpt was identified.";
        evidence.hidden = false;
      }
    }
  }

  /* ---------------------------------------------------------
     Investor brief
     --------------------------------------------------------- */

  function renderInvestorBrief(result) {
    const container =
      $("#investorBriefList");

    if (!container) return;

    container.innerHTML = "";

    const insights =
      result.investorBrief || [];

    if (!insights.length) {
      container.innerHTML = `
        <div class="empty-state">
          Forge could not produce enough evidence-backed investor observations from this document.
        </div>
      `;
      return;
    }

    insights.forEach((insight, index) => {
      const item =
        document.createElement("article");

      item.className =
        "investor-item";

      item.innerHTML = `
        <div class="investor-number"></div>
        <div class="investor-content">
          <div class="investor-item-title"></div>
          <div class="investor-item-text"></div>
        </div>
      `;

      item.querySelector(
        ".investor-number"
      ).textContent =
        String(index + 1).padStart(2, "0");

      item.querySelector(
        ".investor-item-title"
      ).textContent =
        insight.title;

      item.querySelector(
        ".investor-item-text"
      ).textContent =
        insight.text;

      container.appendChild(item);
    });
  }

  /* ---------------------------------------------------------
     Financial table
     --------------------------------------------------------- */

  function renderFinancialTable(result) {
    const table =
      $("#financialTable");

    if (!table) return;

    const body =
      table.querySelector("tbody");

    if (!body) return;

    body.innerHTML = "";

    const rows =
      result.financialTable || [];

    rows.forEach(row => {
      const tr =
        document.createElement("tr");

      tr.innerHTML = `
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      `;

      tr.children[0].textContent =
        row.label;

      tr.children[1].textContent =
        formatTableValue(
          row.label,
          row.value
        );

      tr.children[2].textContent =
        row.year || "—";

      tr.children[3].textContent =
        row.basis === "calculated"
          ? "Calculated"
          : row.basis === "reported"
            ? "Reported"
            : "Not available";

      body.appendChild(tr);
    });
  }

  function formatTableValue(label, value) {
    if (!Number.isFinite(value)) {
      return "Not found";
    }

    if (
      label === "Current ratio" ||
      label === "Debt to equity"
    ) {
      return `${round(value, 2)}x`;
    }

    return formatFinancialAmount(value);
  }

  /* ---------------------------------------------------------
     Methodology
     --------------------------------------------------------- */

  function renderMethodology(result) {
    const methodology =
      result.methodology;

    if (!methodology) return;

    setText(
      "#methodologyEngine",
      methodology.engine
    );

    setText(
      "#methodologyReported",
      methodology.reportedValues
    );

    setText(
      "#methodologyCalculated",
      methodology.calculatedValues
    );

    setText(
      "#methodologyExternal",
      methodology.noExternalData
    );

    const limitations =
      $("#methodologyLimitations");

    if (
      limitations &&
      Array.isArray(methodology.limitations)
    ) {
      limitations.innerHTML = "";

      methodology.limitations.forEach(item => {
        const li =
          document.createElement("li");

        li.textContent = item;

        limitations.appendChild(li);
      });
    }
  }

  /* ---------------------------------------------------------
     Warnings
     --------------------------------------------------------- */

  function renderWarnings(result) {
    const container =
      $("#analysisWarnings");

    if (!container) return;

    container.innerHTML = "";

    const warnings =
      result.warnings || [];

    if (!warnings.length) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    warnings.forEach(warning => {
      const item =
        document.createElement("div");

      item.className =
        "analysis-warning";

      item.textContent =
        warning;

      container.appendChild(item);
    });
  }

  /* ---------------------------------------------------------
     Navigation
     --------------------------------------------------------- */

  function bindNavigation() {
    $$(".nav-item").forEach(item => {
      item.addEventListener("click", event => {
        event.preventDefault();

        const target =
          item.dataset.view ||
          item.getAttribute("href")?.replace("#", "");

        if (!target) return;

        navigateTo(target);

        $$(".nav-item").forEach(nav =>
          nav.classList.remove("active")
        );

        item.classList.add("active");
      });
    });
  }

  function navigateTo(view) {
    state.currentView = view;

    const results =
      $("#resultsSection");

    if (!results) return;

    if (!state.analysis) {
      showUploadState();
      return;
    }

    const targets = {
      dashboard: "#dashboardPanel",
      analysis: "#analysisPanel",
      risk: "#riskPanel",
      investor: "#investorPanel",
      methodology: "#methodologyPanel"
    };

    const targetSelector =
      targets[view];

    if (!targetSelector) {
      showResultsState();
      return;
    }

    $$(".result-panel").forEach(panel => {
      panel.hidden = true;
    });

    const target =
      $(targetSelector);

    if (target) {
      target.hidden = false;
    } else {
      showResultsState();
    }
  }

  /* ---------------------------------------------------------
     Settings
     --------------------------------------------------------- */

  function bindSettings() {
    const clearHistory =
      $("#clearHistory");

    if (clearHistory) {
      clearHistory.addEventListener(
        "click",
        clearStoredHistory
      );
    }

    const resetWorkspace =
      $("#resetWorkspace");

    if (resetWorkspace) {
      resetWorkspace.addEventListener(
        "click",
        resetWorkspaceCompletely
      );
    }
  }

  function clearStoredHistory() {
    const confirmed =
      window.confirm(
        "Clear saved Forge analysis history and cached analysis?"
      );

    if (!confirmed) return;

    localStorage.removeItem(
      STORAGE_KEYS.history
    );

    localStorage.removeItem(
      STORAGE_KEYS.lastAnalysis
    );

    state.history = [];
    state.analysis = null;

    updateHistoryCount();

    showToast(
      "Saved analysis history cleared."
    );
  }

  function resetWorkspaceCompletely() {
    const confirmed =
      window.confirm(
        "Reset Forge completely? Your name, saved history and current analysis will be cleared."
      );

    if (!confirmed) return;

    localStorage.removeItem(
      STORAGE_KEYS.userName
    );

    localStorage.removeItem(
      STORAGE_KEYS.history
    );

    localStorage.removeItem(
      STORAGE_KEYS.lastAnalysis
    );

    state.userName = "";
    state.file = null;
    state.analysis = null;
    state.history = [];

    closeSettingsModal();

    const input = $("#nameInput");

    if (input) {
      input.value = "";
    }

    showWelcome();

    showToast(
      "Forge workspace reset."
    );
  }

  /* ---------------------------------------------------------
     User menu
     --------------------------------------------------------- */

  function bindUserMenu() {
    const menuButton =
      $("#userMenuButton");

    const menu =
      $("#userMenu");

    if (!menuButton || !menu) return;

    menuButton.addEventListener(
      "click",
      event => {
        event.stopPropagation();

        menu.classList.toggle("open");
      }
    );

    document.addEventListener(
      "click",
      event => {
        if (
          !menu.contains(event.target) &&
          !menuButton.contains(event.target)
        ) {
          menu.classList.remove("open");
        }
      }
    );
  }

  /* ---------------------------------------------------------
     Modal controls
     --------------------------------------------------------- */

  function bindModalControls() {
    const settingsButton =
      $("#settingsButton");

    if (settingsButton) {
      settingsButton.addEventListener(
        "click",
        openSettingsModal
      );
    }

    const closeButton =
      $("#closeSettings");

    if (closeButton) {
      closeButton.addEventListener(
        "click",
        closeSettingsModal
      );
    }

    const overlay =
      $("#settingsModal");

    if (overlay) {
      overlay.addEventListener(
        "click",
        event => {
          if (event.target === overlay) {
            closeSettingsModal();
          }
        }
      );
    }

    document.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape") {
          closeSettingsModal();
        }
      }
    );
  }

  function openSettingsModal() {
    const modal =
      $("#settingsModal");

    if (!modal) return;

    modal.hidden = false;
    modal.classList.add("open");

    updateSettingsInfo();
  }

  function closeSettingsModal() {
    const modal =
      $("#settingsModal");

    if (!modal) return;

    modal.classList.remove("open");
    modal.hidden = true;
  }

  function updateSettingsInfo() {
    setText(
      "#settingsUserName",
      state.userName || "Not set"
    );

    setText(
      "#settingsHistoryCount",
      String(state.history.length)
    );

    setText(
      "#settingsCurrentFile",
      state.file?.name || "No file loaded"
    );
  }

  /* ---------------------------------------------------------
     Storage
     --------------------------------------------------------- */

  function loadStoredState() {
    state.userName =
      localStorage.getItem(
        STORAGE_KEYS.userName
      ) || "";

    try {
      const history =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEYS.history
          ) || "[]"
        );

      state.history =
        Array.isArray(history)
          ? history
          : [];
    } catch {
      state.history = [];
    }

    /*
     * Do not automatically restore a full analysis into the UI.
     * The uploaded source file itself may no longer exist, so restoring
     * results without the source could mislead the user.
     */
  }

  function saveAnalysis(result) {
    const record = {
      id:
        `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,

      fileName:
        result.document?.fileName ||
        "Uploaded document",

      companyName:
        result.document?.companyName ||
        "Uploaded company",

      period:
        result.document?.fiscalYears?.[0] ||
        null,

      analyzedAt:
        result.analyzedAt ||
        new Date().toISOString(),

      metrics: {
        revenue:
          result.metrics?.revenue?.value ?? null,

        grossProfit:
          result.metrics?.grossProfit?.value ?? null,

        netProfit:
          result.metrics?.netProfit?.value ?? null
      }
    };

    state.history.unshift(record);

    /*
     * Keep history lightweight. Do not store the full uploaded
     * document or huge extracted text in localStorage.
     */
    state.history =
      state.history.slice(0, 20);

    localStorage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify(state.history)
    );

    /*
     * The complete analysis is intentionally not persisted.
     * This prevents stale financial data from appearing later without
     * the user uploading the source document again.
     */

    updateHistoryCount();
  }

  function updateHistoryCount() {
    setText(
      "#historyCount",
      String(state.history.length)
    );

    setText(
      "#settingsHistoryCount",
      String(state.history.length)
    );
  }

  /* ---------------------------------------------------------
     UI states
     --------------------------------------------------------- */

  function hideAllSections() {
    [
      "#uploadSection",
      "#analysisSection",
      "#errorSection",
      "#resultsSection"
    ].forEach(selector => {
      const element = $(selector);

      if (element) {
        element.hidden = true;
      }
    });
  }

  function showSection(id) {
    hideAllSections();

    const element =
      document.getElementById(id);

    if (element) {
      element.hidden = false;
    }
  }

  function showUploadState() {
    showSection("uploadSection");

    const analysis =
      $("#analysisSection");

    if (analysis) {
      analysis.hidden = true;
    }

    const error =
      $("#errorSection");

    if (error) {
      error.hidden = true;
    }

    updateSidebarState();
  }

  function showResultsState() {
    const results =
      $("#resultsSection");

    if (!results) return;

    hideAllSections();

    results.hidden = false;

    const analysis =
      $("#analysisSection");

    if (analysis) {
      analysis.hidden = true;
    }

    const dashboard =
      $("#dashboardPanel");

    if (dashboard) {
      $$(".result-panel").forEach(
        panel => {
          panel.hidden = true;
        }
      );

      dashboard.hidden = false;
    }

    updateSidebarState();
  }

  function showError(message) {
    hideAllSections();

    const error =
      $("#errorSection");

    if (!error) {
      window.alert(message);
      return;
    }

    error.hidden = false;

    setText(
      "#errorMessage",
      message
    );

    const details =
      $("#errorDetails");

    if (details) {
      details.textContent =
        "No financial result was created from this attempt.";
    }

    updateSidebarState();
  }

  function hideResults() {
    const results =
      $("#resultsSection");

    if (results) {
      results.hidden = true;
    }
  }

  /* ---------------------------------------------------------
     Reset
     --------------------------------------------------------- */

  function resetForNewAnalysis() {
    state.file = null;
    state.analysis = null;
    state.currentView = "dashboard";

    const fileInput =
      $("#fileInput");

    if (fileInput) {
      fileInput.value = "";
      fileInput.disabled = false;
    }

    const analyzeButton =
      $("#analyzeButton");

    if (analyzeButton) {
      analyzeButton.disabled = true;
    }

    const uploadSection =
      $("#uploadSection");

    if (uploadSection) {
      uploadSection.classList.remove(
        "file-ready"
      );
    }

    const fileReady =
      $("#fileReady");

    if (fileReady) {
      fileReady.hidden = true;
    }

    setText(
      "#sidebarDocument",
      "No document loaded"
    );

    setText(
      "#topbarDocument",
      "No document loaded"
    );

    showUploadState();
  }

  /* ---------------------------------------------------------
     Sidebar
     --------------------------------------------------------- */

  function updateSidebarState() {
    const documentName =
      state.analysis?.document?.fileName ||
      state.file?.name ||
      "No document loaded";

    const companyName =
      state.analysis?.document?.companyName ||
      "No company loaded";

    const period =
      state.analysis?.document?.fiscalYears?.[0] ||
      "—";

    setText(
      "#sidebarDocument",
      documentName
    );

    setText(
      "#sidebarCompany",
      companyName
    );

    setText(
      "#sidebarPeriod",
      period
    );
  }

  function updateUserLabels() {
    setText(
      "#workspaceUserName",
      state.userName || "User"
    );

    setText(
      "#userNameDisplay",
      state.userName || "User"
    );

    const initial =
      state.userName
        ? state.userName
            .trim()
            .charAt(0)
            .toUpperCase()
        : "U";

    setText(
      "#userInitial",
      initial
    );
  }

  /* ---------------------------------------------------------
     Toast
     --------------------------------------------------------- */

  function showToast(message) {
    let toast =
      $("#forgeToast");

    if (!toast) {
      toast =
        document.createElement("div");

      toast.id =
        "forgeToast";

      toast.className =
        "toast";

      document.body.appendChild(toast);
    }

    toast.textContent = message;

    toast.classList.add("visible");

    clearTimeout(
      showToast.timeout
    );

    showToast.timeout =
      setTimeout(() => {
        toast.classList.remove(
          "visible"
        );
      }, 2800);
  }

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */

  function setText(selector, value) {
    const element = $(selector);

    if (element) {
      element.textContent =
        value === null ||
        value === undefined
          ? ""
          : String(value);
    }
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) {
      return "";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${round(bytes / 1024, 1)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
      return `${round(
        bytes / (1024 * 1024),
        1
      )} MB`;
    }

    return `${round(
      bytes / (1024 * 1024 * 1024),
      2
    )} GB`;
  }

  function formatFinancialAmount(value) {
    if (!Number.isFinite(value)) {
      return "Not found";
    }

    const absolute =
      Math.abs(value);

    let formatted;

    if (absolute >= 1e12) {
      formatted =
        `${round(value / 1e12, 2)}T`;
    } else if (absolute >= 1e9) {
      formatted =
        `${round(value / 1e9, 2)}B`;
    } else if (absolute >= 1e6) {
      formatted =
        `${round(value / 1e6, 2)}M`;
    } else if (absolute >= 1e3) {
      formatted =
        `${round(value / 1e3, 2)}K`;
    } else {
      formatted =
        numberWithCommas(
          round(value, 2)
        );
    }

    return formatted;
  }

  function numberWithCommas(value) {
    const parts =
      String(value).split(".");

    parts[0] =
      parts[0].replace(
        /\B(?=(\d{3})+(?!\d))/g,
        ","
      );

    return parts.join(".");
  }

  function round(value, decimals) {
    if (!Number.isFinite(value)) {
      return null;
    }

    const factor =
      Math.pow(10, decimals);

    return Math.round(
      value * factor
    ) / factor;
  }

  function capitalize(value) {
    return String(value)
      .charAt(0)
      .toUpperCase() +
      String(value).slice(1);
  }

  function wait(ms) {
    return new Promise(
      resolve => setTimeout(resolve, ms)
    );
  }

  function normalizeErrorMessage(error) {
    const raw =
      error?.message ||
      String(error || "");

    if (
      /password|encrypted/i.test(raw)
    ) {
      return "This document appears to be password-protected or encrypted. Upload an accessible copy.";
    }

    if (
      /scanned|image-only|too little readable text/i.test(raw)
    ) {
      return "Forge could not extract enough selectable text. This document may be scanned or image-only.";
    }

    if (
      /PDF\.js|PDF parsing library/i.test(raw)
    ) {
      return "The PDF parsing library did not load correctly. Please refresh the page and try again.";
    }

    if (
      /Mammoth|DOCX parsing library/i.test(raw)
    ) {
      return "The DOCX parsing library did not load correctly. Please refresh the page and try again.";
    }

    if (
      /SheetJS|spreadsheet parsing library/i.test(raw)
    ) {
      return "The spreadsheet parsing library did not load correctly. Please refresh the page and try again.";
    }

    return raw ||
      "Forge could not complete the analysis. Please verify the uploaded file and try again.";
  }

  /* ---------------------------------------------------------
     Expose small public interface
     --------------------------------------------------------- */

  window.ForgeApp = {
    state,
    startAnalysis,
    handleFile,
    resetForNewAnalysis
  };

})();
