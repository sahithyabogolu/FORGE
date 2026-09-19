(function (window) {
  "use strict";

  const finite = value => Number.isFinite(value);
  const ratio = (top, bottom) => finite(top) && finite(bottom) && bottom !== 0 ? top / bottom : null;
  const change = (current, previous) => finite(current) && finite(previous) && previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;

  function metric(current, previous, source) {
    return { current: finite(current) ? current : null, previous: finite(previous) ? previous : null, source: source || "N/A" };
  }

  function statusForLiquidity(value) {
    if (!finite(value)) return ["N/A — insufficient information", "Current assets or liabilities were not reliably identified."];
    if (value < 1) return ["Requires attention", "Current liabilities exceed current assets."];
    if (value < 1.5) return ["Monitor", "The current ratio is positive but limited."];
    return ["Stable", "Current assets exceed current liabilities."];
  }

  function statusForLeverage(value) {
    if (!finite(value)) return ["N/A — insufficient information", "Debt or equity was not reliably identified."];
    if (value > 2) return ["Requires attention", "Debt is more than twice reported equity."];
    if (value > 1) return ["Monitor", "Debt exceeds reported equity."];
    return ["Stable", "Debt does not exceed reported equity."];
  }

  function analyze(parsed) {
    const m = parsed.metrics;
    const revenue = metric(m.revenue.current, m.revenue.previous, m.revenue.source);
    const grossProfit = metric(m.grossProfit.current, m.grossProfit.previous, m.grossProfit.source);
    const netIncome = metric(m.netIncome.current, m.netIncome.previous, m.netIncome.source);
    const operatingCashFlow = metric(m.operatingCashFlow.current, m.operatingCashFlow.previous, m.operatingCashFlow.source);

    const currentRatio = ratio(m.currentAssets.current, m.currentLiabilities.current);
    const currentRatioPrevious = ratio(m.currentAssets.previous, m.currentLiabilities.previous);
    const debtCurrent = (m.shortDebt.current || 0) + (m.longDebt.current || 0);
    const debtPrevious = (m.shortDebt.previous || 0) + (m.longDebt.previous || 0);
    const debtEquity = finite(m.equity.current) && (finite(m.shortDebt.current) || finite(m.longDebt.current)) ? ratio(debtCurrent, m.equity.current) : null;
    const debtEquityPrevious = finite(m.equity.previous) && (finite(m.shortDebt.previous) || finite(m.longDebt.previous)) ? ratio(debtPrevious, m.equity.previous) : null;
    const grossMargin = ratio(grossProfit.current, revenue.current);
    const grossMarginPrevious = ratio(grossProfit.previous, revenue.previous);
    const netMargin = ratio(netIncome.current, revenue.current);
    const netMarginPrevious = ratio(netIncome.previous, revenue.previous);
    const cashConversion = ratio(operatingCashFlow.current, netIncome.current);
    const cashConversionPrevious = ratio(operatingCashFlow.previous, netIncome.previous);

    const metrics = {
      revenue, grossProfit, netIncome, operatingCashFlow,
      currentRatio: metric(currentRatio, currentRatioPrevious, "Calculated"),
      debtEquity: metric(debtEquity, debtEquityPrevious, "Calculated"),
      grossMargin: metric(grossMargin, grossMarginPrevious, "Calculated"),
      netMargin: metric(netMargin, netMarginPrevious, "Calculated"),
      cashConversion: metric(cashConversion, cashConversionPrevious, "Calculated")
    };

    const risks = [];
    const [liquidityStatus, liquidityReason] = statusForLiquidity(currentRatio);
    const [leverageStatus, leverageReason] = statusForLeverage(debtEquity);
    risks.push({ title: "Liquidity", status: liquidityStatus, reason: liquidityReason });
    risks.push({ title: "Leverage", status: leverageStatus, reason: leverageReason });

    if (!finite(operatingCashFlow.current)) risks.push({ title: "Cash generation", status: "N/A — insufficient information", reason: "Operating cash flow was not reliably identified." });
    else if (operatingCashFlow.current < 0) risks.push({ title: "Cash generation", status: "Requires attention", reason: "Reported operating cash flow is negative." });
    else risks.push({ title: "Cash generation", status: "Stable", reason: "Reported operating cash flow is positive." });

    if (!finite(netMargin)) risks.push({ title: "Profitability", status: "N/A — insufficient information", reason: "Revenue or net income was not reliably identified." });
    else if (netMargin < 0) risks.push({ title: "Profitability", status: "Requires attention", reason: "Reported net income is negative relative to revenue." });
    else risks.push({ title: "Profitability", status: "Stable", reason: "Reported net income is positive relative to revenue." });

    const brief = [];
    if (finite(revenue.current)) {
      const delta = change(revenue.current, revenue.previous);
      brief.push(delta == null ? "Revenue was identified in the uploaded filing." : `Revenue ${delta >= 0 ? "increased" : "decreased"} ${Math.abs(delta).toFixed(1)}% versus the identified prior period.`);
    } else brief.push("Revenue: N/A — insufficient information in uploaded filing.");

    if (finite(netMargin)) brief.push(`Net margin was ${(netMargin * 100).toFixed(1)}% based on extracted net income and revenue.`);
    else brief.push("Profitability: N/A — insufficient information in uploaded filing.");

    if (finite(cashConversion)) brief.push(`Operating cash flow represented ${(cashConversion * 100).toFixed(1)}% of reported net income.`);
    else brief.push("Earnings quality: N/A — insufficient information in uploaded filing.");

    if (parsed.goingConcern.findings.length) brief.push("The document contains a potential going-concern or liquidity-related disclosure. Review the cited context before reaching conclusions.");
    else brief.push("No explicit going-concern disclosure was identified by this automated text review; this is not a professional conclusion.");

    return { ...parsed, metrics, risks, brief };
  }

  window.ForgeAnalyzer = { analyze };
})(window);
