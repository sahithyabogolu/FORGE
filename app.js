(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const welcome = $("#welcomeScreen");
  const dashboard = $("#dashboard");
  const form = $("#nameForm");
  const input = $("#analystName");

  let activeCompany = "apple";

  const safeText = (value) =>
    String(value ?? "").replace(
      /[<>&"']/g,
      (character) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&#039;"
        })[character]
    );

  const n = (value, suffix = "") =>
    Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : "—";

  const ratio = (top, bottom) => (bottom ? top / bottom : null);

  const pct = (top, bottom) => (bottom ? (top / bottom) * 100 : null);

  const latest = (array) => array[array.length - 1];

  function calculations(financials) {
    return {
      currentRatio: financials.currentAssets.map((value, index) =>
        ratio(value, financials.currentLiabilities[index])
      ),

      debtEquity: financials.totalDebt.map((value, index) =>
        ratio(value, financials.equity[index])
      ),

      grossMargin: financials.grossProfit.map((value, index) =>
        pct(value, financials.revenue[index])
      ),

      netMargin: financials.netIncome.map((value, index) =>
        pct(value, financials.revenue[index])
      ),

      cashConversion: financials.operatingCashFlow.map((value, index) =>
        pct(value, financials.netIncome[index])
      )
    };
  }

  function barChart(label, values, years, color) {
    const max = Math.max(...values.map((value) => Math.abs(value)), 1);

    return `
      <article class="chart panel">
        <div class="chart-title">
          <span>${label}</span>
          <span class="reported">REPORTED</span>
        </div>

        <div class="bars">
          ${values
            .map(
              (value, index) => `
                <div class="bar-unit">
                  <span class="bar-value">${n(value)}</span>

                  <div class="bar-track">
                    <i
                      style="
                        height: ${Math.max(4, (Math.abs(value) / max) * 100)}%;
                        background: ${value < 0 ? "#e15d5d" : color};
                      "
                    ></i>
                  </div>

                  <small>${years[index]}</small>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
    `;
  }

  function signal(text, kind) {
    return `
      <p class="signal ${kind}">
        <i></i>
        ${safeText(text)}
      </p>
    `;
  }

  function showStatus(message, error = false) {
    const element = $("#status");
    element.textContent = message;
    element.className = `status ${error ? "error" : ""}`;
  }

  function render() {
    const company = FORGE_DATA[activeCompany];

    if (!company) {
      showStatus("The requested company dataset is unavailable.", true);
      return;
    }

    const financials = company.financials;
    const calculated = calculations(financials);
    const years = company.years;

    $("#companyName").textContent = company.name;
    $("#companyDescription").textContent = company.description;
    $("#companyTicker").textContent = company.ticker;
    $("#sourceText").textContent = company.source;

    $("#companyTabs").innerHTML = Object.entries(FORGE_DATA)
      .map(
        ([key, companyData]) => `
          <button
            class="company-tab ${key === activeCompany ? "selected" : ""}"
            data-company="${key}"
          >
            ${safeText(companyData.name)}
            <span>${safeText(companyData.ticker)}</span>
          </button>
        `
      )
      .join("");

    const metric = (name, value, unit, type) => `
      <article class="metric panel">
        <span>${name}</span>
        <strong>${n(value, unit)}</strong>
        <small>${type}</small>
      </article>
    `;

    $("#metricsGrid").innerHTML = [
      metric("Revenue", latest(financials.revenue), "B", "REPORTED · FY 2024"),
      metric("Net income", latest(financials.netIncome), "B", "REPORTED · FY 2024"),
      metric(
        "Operating cash flow",
        latest(financials.operatingCashFlow),
        "B",
        "REPORTED · FY 2024"
      ),
      metric(
        "Gross margin",
        latest(calculated.grossMargin),
        "%",
        "CALCULATED · FY 2024"
      ),
      metric(
        "Current ratio",
        latest(calculated.currentRatio),
        "x",
        "CALCULATED · FY 2024"
      ),
      metric(
        "Debt / equity",
        latest(calculated.debtEquity),
        "x",
        "CALCULATED · FY 2024"
      )
    ].join("");

    $("#chartGrid").innerHTML =
      barChart("Revenue", financials.revenue, years, "#b6f56e") +
      barChart("Gross profit", financials.grossProfit, years, "#86c9ff") +
      barChart("Net income", financials.netIncome, years, "#d3a8ff") +
      barChart(
        "Operating cash flow",
        financials.operatingCashFlow,
        years,
        "#ffc76b"
      );

    const rows = [
      ["Current ratio", calculated.currentRatio, "x"],
      ["Debt / equity", calculated.debtEquity, "x"],
      ["Gross margin", calculated.grossMargin, "%"],
      ["Net margin", calculated.netMargin, "%"],
      ["Cash conversion", calculated.cashConversion, "%"]
    ];

    $("#statisticsTable").innerHTML = rows
      .map(
        ([label, values, unit]) => `
          <tr>
            <th>
              ${label}
              <small>CALCULATED</small>
            </th>

            ${values.map((value) => `<td>${n(value, unit)}</td>`).join("")}
          </tr>
        `
      )
      .join("");

    const revenueGrowth = pct(
      latest(financials.revenue) - financials.revenue[0],
      financials.revenue[0]
    );

    const marginChange =
      latest(calculated.netMargin) - calculated.netMargin[0];

    const currentRatio = latest(calculated.currentRatio);
    const debtEquity = latest(calculated.debtEquity);
    const cashConversion = latest(calculated.cashConversion);

    $("#signals").innerHTML =
      signal(
        `Revenue changed ${n(revenueGrowth, "%")} across the period.`,
        revenueGrowth >= 0 ? "positive" : "negative"
      ) +
      signal(
        `Net margin ${
          marginChange >= 0 ? "expanded" : "contracted"
        } by ${n(Math.abs(marginChange), " percentage points")} from 2020 to 2024.`,
        marginChange >= 0 ? "positive" : "watch"
      ) +
      signal(
        `Operating cash flow was ${n(cashConversion, "%")} of 2024 net income.`,
        cashConversion >= 100 ? "positive" : "watch"
      );

    $("#risks").innerHTML =
      signal(
        `Liquidity: current ratio is ${n(
          currentRatio,
          "x"
        )}. A value below 1.0 means current liabilities exceed current assets.`,
        currentRatio < 1 ? "watch" : "positive"
      ) +
      signal(
        `Leverage: debt/equity is ${n(
          debtEquity,
          "x"
        )}. This compares reported total debt with reported shareholders’ equity.`,
        debtEquity > 1 ? "watch" : "positive"
      ) +
      signal(
        "Results do not include valuation, market-price, segment, or forward-looking analysis.",
        "neutral"
      );

    const positiveLatestYear =
      latest(financials.netIncome) > 0 &&
      latest(financials.operatingCashFlow) > 0;

    const goingConcernText = positiveLatestYear
      ? "The latest bundled year shows positive net income and positive operating cash flow. Those are supportive indicators, but this tool cannot make a going-concern conclusion."
      : "The latest bundled year requires closer review because either net income or operating cash flow is not positive. This tool cannot make a going-concern conclusion.";

    $("#goingConcern").innerHTML =
      signal(goingConcernText, positiveLatestYear ? "positive" : "watch") +
      signal(
        "Read the original annual report’s risk factors, liquidity disclosures, and auditor report for a complete assessment.",
        "neutral"
      );

    document.querySelectorAll("[data-company]").forEach((button) => {
      button.addEventListener("click", () => {
        activeCompany = button.dataset.company;
        render();

        window.scrollTo({
          top: document.querySelector(".company-heading").offsetTop - 80,
          behavior: "smooth"
        });
      });
    });
  }

  function enter(name) {
    const cleanName = name.trim();

    if (cleanName.length < 2) {
      $("#nameError").textContent =
        "Please enter at least two characters.";
      input.focus();
      return;
    }

    localStorage.setItem("forgeAnalyst", cleanName);

    $("#welcomeName").textContent = `Welcome, ${cleanName}`;

    welcome.classList.add("hidden");
    dashboard.classList.remove("hidden");

    showStatus(
      "Dataset loaded: Apple, Microsoft and Amazon. Figures are rounded."
    );

    render();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    enter(input.value);
  });

  $("#resetName").addEventListener("click", () => {
    localStorage.removeItem("forgeAnalyst");

    dashboard.classList.add("hidden");
    welcome.classList.remove("hidden");

    input.value = "";
    input.focus();
  });

  const savedName = localStorage.getItem("forgeAnalyst");

  if (savedName) {
    enter(savedName);
  }
})();
