(function () {
  "use strict";

  const STORE = {
    user: "forge_user_name",
    history: "forge_analysis_history"
  };

  const state = { userName: "", analysis: null, currentView: "dashboard" };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const na = "N/A — insufficient information in uploaded filing";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    state.userName = localStorage.getItem(STORE.user) || "";
    bindEvents();
    updateUser();
    state.userName ? showScreen("workspaceScreen") : showScreen("welcomeScreen");
    showWorkspaceSection("uploadSection");
  }

  function bindEvents() {
    $("#enterForgeBtn").addEventListener("click", enterForge);
    $("#userName").addEventListener("keydown", event => { if (event.key === "Enter") enterForge(); });
    $("#browseFilesBtn").addEventListener("click", event => { event.stopPropagation(); $("#fileInput").click(); });
    $("#fileInput").addEventListener("change", event => event.target.files[0] && startAnalysis(event.target.files[0]));
    $("#dropZone").addEventListener("click", () => $("#fileInput").click());
    $("#dropZone").addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") $("#fileInput").click(); });
    ["dragenter", "dragover"].forEach(type => $("#dropZone").addEventListener(type, event => { event.preventDefault(); $("#dropZone").classList.add("drag-active"); }));
    ["dragleave", "drop"].forEach(type => $("#dropZone").addEventListener(type, event => { event.preventDefault(); $("#dropZone").classList.remove("drag-active"); }));
    $("#dropZone").addEventListener("drop", event => event.dataTransfer.files[0] && startAnalysis(event.dataTransfer.files[0]));
    $("#newAnalysisBtn").addEventListener("click", resetForNewAnalysis);
    $("#tryAgainBtn").addEventListener("click", resetForNewAnalysis);
    $("#exportReportBtn").addEventListener("click", exportReport);

    $$(".nav-item").forEach(button => button.addEventListener("click", () => showResultView(button.dataset.section)));
    $("#settingsBtn").addEventListener("click", () => $("#settingsOverlay").classList.add("open"));
    $("#closeSettingsBtn").addEventListener("click", () => $("#settingsOverlay").classList.remove("open"));
    $("#clearHistoryBtn").addEventListener("click", () => { localStorage.removeItem(STORE.history); toast("Analysis history cleared."); });
    $("#clearCacheBtn").addEventListener("click", () => { localStorage.removeItem(STORE.history); toast("Cached workspace data cleared."); });
    $("#resetWorkspaceBtn").addEventListener("click", resetWorkspace);
    $("#openSidebarBtn").addEventListener("click", () => $("#sidebar").classList.add("open"));
    $("#closeSidebarBtn").addEventListener("click", () => $("#sidebar").classList.remove("open"));
  }

  function enterForge() {
    const name = $("#userName").value.trim();
    if (!name) { $("#nameError").textContent = "Please enter your name to continue."; return; }
    state.userName = name;
    localStorage.setItem(STORE.user, name);
    $("#nameError").textContent = "";
    updateUser();
    showScreen("workspaceScreen");
  }

  function updateUser() {
    const name = state.userName || "User";
    $("#topbarUserName").textContent = name;
    $("#settingsUserName").textContent = name;
    $("#userInitial").textContent = name.charAt(0).toUpperCase();
  }

  function showScreen(id) {
    $$(".screen").forEach(screen => screen.classList.toggle("active", screen.id === id));
  }

  function showWorkspaceSection(id) {
    $$(".workspace-section").forEach(section => section.classList.toggle("active", section.id === id));
  }

  function updateProgress(data) {
    const value = Math.max(0, Math.min(100, data.value || 0));
    $("#analysisProgressBar").style.width = `${value}%`;
    $("#analysisPercent").textContent = `${value}%`;
    $("#analysisStepLabel").textContent = data.step || "Processing";
    $("#analysisStatusText").textContent = data.detail || "";
  }

  async function startAnalysis(file) {
    try {
      if (!window.ForgeParser || !window.ForgeAnalyzer) throw new Error("FORGE application files did not load correctly. Refresh the page and try again.");
      showWorkspaceSection("analysisSection");
      updateProgress({ value: 2, step: "Reading document", detail: file.name });

      const parsed = await window.ForgeParser.analyzeFile(file, updateProgress);
      updateProgress({ value: 84, step: "Calculating financial metrics", detail: "Computing only metrics supported by extracted values." });
      const analysis = window.ForgeAnalyzer.analyze(parsed);
      updateProgress({ value: 96, step: "Preparing investor brief", detail: "Rendering evidence-based observations." });

      state.analysis = analysis;
      saveHistory(analysis);
      renderAnalysis(analysis);
      updateProgress({ value: 100, step: "Analysis complete", detail: "Financial analysis is ready." });
      setTimeout(() => showWorkspaceSection("resultsSection"), 250);
    } catch (error) {
      $("#errorTitle").textContent = "Analysis unavailable";
      $("#errorMessage").textContent = readableError(error);
      showWorkspaceSection("errorSection");
    }
  }

  function readableError(error) {
    const message = error && error.message ? error.message : String(error || "");
    if (/image-only|scanned/i.test(message)) return "No extractable text was found. This may be an image-only or scanned PDF. OCR would be required, but is not included in this browser-only version.";
    return message || "FORGE could not reliably extract the required financial information.";
  }

  function formatMoney(value) {
    if (!Number.isFinite(value)) return "N/A";
    const abs = Math.abs(value);
    const units = abs >= 1e9 ? [1e9, "B"] : abs >= 1e6 ? [1e6, "M"] : abs >= 1e3 ? [1e3, "K"] : [1, ""];
    return `${value < 0 ? "-" : ""}$${(abs / units[0]).toLocaleString(undefined, { maximumFractionDigits: 2 })}${units[1]}`;
  }

  function formatRatio(value) { return Number.isFinite(value) ? `${value.toFixed(2)}x` : "N/A"; }
  function formatPercent(value) { return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "N/A"; }
  function changeText(current, previous, percent) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return "No prior-period comparison";
    const result = ((current - previous) / Math.abs(previous)) * 100;
    return `${result >= 0 ? "↑" : "↓"} ${Math.abs(result).toFixed(1)}% vs previous`;
  }

  function renderAnalysis(a) {
    $("#resultCompanyName").textContent = a.companyName;
    $("#resultPeriod").textContent = a.years.length ? `Fiscal years identified: ${a.years.join(", ")}` : "Fiscal period unavailable";
    $("#resultCurrency").textContent = `Amounts: ${a.units.label}`;
    $("#resultSourceType").textContent = a.sourceType;
    $("#topbarDocument").textContent = a.fileName;
    $("#sidebarCompany").textContent = a.companyName;
    $("#sidebarPeriod").textContent = a.years.length ? String(a.years[0]) : "Period unavailable";

    const m = a.metrics;
    $("#metricRevenue").textContent = formatMoney(m.revenue.current);
    $("#metricRevenueChange").textContent = changeText(m.revenue.current, m.revenue.previous);
    $("#metricGrossProfit").textContent = formatMoney(m.grossProfit.current);
    $("#metricGrossMargin").textContent = Number.isFinite(m.grossMargin.current) ? `${formatPercent(m.grossMargin.current)} gross margin • ${m.grossProfit.source}` : na;
    $("#metricNetIncome").textContent = formatMoney(m.netIncome.current);
    $("#metricNetMargin").textContent = Number.isFinite(m.netMargin.current) ? `${formatPercent(m.netMargin.current)} net margin` : na;
    $("#metricOperatingCF").textContent = formatMoney(m.operatingCashFlow.current);
    $("#metricCashConversion").textContent = Number.isFinite(m.cashConversion.current) ? `${formatPercent(m.cashConversion.current)} of net income` : na;
    $("#metricCurrentRatio").textContent = formatRatio(m.currentRatio.current);
    $("#metricCurrentRatioStatus").textContent = riskByName(a, "Liquidity").status;
    $("#metricDebtEquity").textContent = formatRatio(m.debtEquity.current);
    $("#metricDebtEquityStatus").textContent = riskByName(a, "Leverage").status;

    renderList($("#dashboardInvestorSummary"), a.brief);
    renderList($("#investorBriefList"), a.brief);
    renderFinancialTable(a);
    renderRisks(a);
    $("#goingConcernStatus").textContent = a.goingConcern.status;
    $("#goingConcernExplanation").textContent = `${a.goingConcern.note}${a.goingConcern.findings.length ? ` Findings: ${a.goingConcern.findings.join(" | ")}` : ""}`;
    showResultView("dashboard");
  }

  function riskByName(analysis, title) {
    return analysis.risks.find(risk => risk.title === title) || { status: "N/A — insufficient information" };
  }

  function renderList(node, values) {
    node.innerHTML = "";
    values.forEach(value => { const item = document.createElement("li"); item.textContent = value; node.appendChild(item); });
  }

  function renderFinancialTable(a) {
    const currentYear = a.years[0] || "Current";
    const previousYear = a.years[1] || "Previous";
    $("#tableCurrentYear").textContent = currentYear;
    $("#tablePreviousYear").textContent = previousYear;
    const rows = [
      ["Revenue", a.metrics.revenue, formatMoney],
      ["Gross Profit", a.metrics.grossProfit, formatMoney],
      ["Net Income", a.metrics.netIncome, formatMoney],
      ["Operating Cash Flow", a.metrics.operatingCashFlow, formatMoney],
      ["Gross Margin", a.metrics.grossMargin, formatPercent],
      ["Net Margin", a.metrics.netMargin, formatPercent],
      ["Current Ratio", a.metrics.currentRatio, formatRatio],
      ["Debt / Equity", a.metrics.debtEquity, formatRatio],
      ["OCF / Net Income", a.metrics.cashConversion, formatPercent]
    ];
    $("#financialTableBody").innerHTML = rows.map(([name, value, formatter]) => `<tr><td>${name}${value.source === "Calculated" ? " <small>(Calculated)</small>" : ""}</td><td>${formatter(value.current)}</td><td>${formatter(value.previous)}</td><td>${changeText(value.current, value.previous)}</td></tr>`).join("");
  }

  function renderRisks(a) {
    $("#riskAnalysisGrid").innerHTML = "";
    a.risks.forEach(risk => {
      const card = document.createElement("article");
      card.className = "risk-card";
      card.innerHTML = `<h3>${risk.title}</h3><div class="status-label">${risk.status}</div><p>${risk.reason}</p>`;
      $("#riskAnalysisGrid").appendChild(card);
    });
  }

  function showResultView(id) {
    state.currentView = id;
    $$(".result-view").forEach(view => view.classList.toggle("active", view.id === id));
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.section === id));
    $("#sidebar").classList.remove("open");
  }

  function saveHistory(analysis) {
    const history = JSON.parse(localStorage.getItem(STORE.history) || "[]");
    history.unshift({ companyName: analysis.companyName, fileName: analysis.fileName, analyzedAt: analysis.analyzedAt });
    localStorage.setItem(STORE.history, JSON.stringify(history.slice(0, 20)));
  }

  function resetForNewAnalysis() {
    state.analysis = null;
    $("#fileInput").value = "";
    $("#topbarDocument").textContent = "No document selected";
    showWorkspaceSection("uploadSection");
  }

  function resetWorkspace() {
    localStorage.removeItem(STORE.user);
    localStorage.removeItem(STORE.history);
    state.userName = "";
    state.analysis = null;
    $("#settingsOverlay").classList.remove("open");
    $("#userName").value = "";
    showScreen("welcomeScreen");
  }

  function toast(message) {
    $("#toastMessage").textContent = message;
    $("#toast").classList.add("show");
    setTimeout(() => $("#toast").classList.remove("show"), 2500);
  }

  function exportReport() {
    const a = state.analysis;
    if (!a) { toast("No completed analysis is available to export."); return; }
    if (!window.jspdf || !window.jspdf.jsPDF) { toast("PDF export library did not load. Refresh and try again."); return; }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const m = a.metrics;
    pdf.setFontSize(19);
    pdf.text("FORGE Financial Intelligence Brief", 40, 48);
    pdf.setFontSize(10);
    pdf.text(`Company/document: ${a.companyName}`, 40, 69);
    pdf.text(`Source: ${a.fileName} | Analysed: ${new Date(a.analyzedAt).toLocaleString()}`, 40, 85);
    pdf.text(`Amounts: ${a.units.label}`, 40, 101);

    const rows = [
      ["Revenue", formatMoney(m.revenue.current), formatMoney(m.revenue.previous)],
      ["Gross Profit", formatMoney(m.grossProfit.current), formatMoney(m.grossProfit.previous)],
      ["Net Income", formatMoney(m.netIncome.current), formatMoney(m.netIncome.previous)],
      ["Operating Cash Flow", formatMoney(m.operatingCashFlow.current), formatMoney(m.operatingCashFlow.previous)],
      ["Current Ratio", formatRatio(m.currentRatio.current), formatRatio(m.currentRatio.previous)],
      ["Debt / Equity", formatRatio(m.debtEquity.current), formatRatio(m.debtEquity.previous)]
    ];
    pdf.autoTable({ startY: 122, head: [["Metric", a.years[0] || "Current", a.years[1] || "Previous"]], body: rows, theme: "grid", styles: { fontSize: 9 } });
    let y = pdf.lastAutoTable.finalY + 28;
    pdf.setFontSize(12);
    pdf.text("Investor observations", 40, y);
    pdf.setFontSize(9);
    a.brief.forEach(item => { y += 17; const lines = pdf.splitTextToSize(`• ${item}`, 500); pdf.text(lines, 40, y); y += (lines.length - 1) * 11; });
    y += 22;
    pdf.setFontSize(8);
    pdf.text("Automated document analysis only. Not investment advice, an audit, or a professional going-concern opinion.", 40, y);
    pdf.save(`FORGE_${a.companyName.replace(/[^a-z0-9]/gi, "_")}_brief.pdf`);
  }
})();
