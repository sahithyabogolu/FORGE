(function(window){
  "use strict";
  const n=x=>Number.isFinite(x), val=(m,i=0)=>m&&n(m.values[i])?m.values[i]:null;
  const div=(a,b)=>n(a)&&n(b)&&b!==0?a/b:null, pct=(a,b)=>n(a)&&n(b)&&b!==0?(a-b)/Math.abs(b):null;
  const item=(m)=>({current:val(m),previous:val(m,1),history:(m&&m.values)||[],source:(m&&m.source)||"N/A"});
  const status=(value,low,high,reason)=>!n(value)?["N/A — insufficient information","Required values were not reliably identified."]:value<low?["Requires attention",reason.low]:value>high?["Requires attention",reason.high]:["Stable",reason.ok];

  function analyze(p){
    const r=item(p.metrics.revenue),gp=item(p.metrics.grossProfit),ni=item(p.metrics.netIncome),ocf=item(p.metrics.operatingCashFlow);
    const ca=item(p.metrics.currentAssets),cl=item(p.metrics.currentLiabilities),sd=item(p.metrics.shortDebt),ld=item(p.metrics.longDebt),eq=item(p.metrics.equity);
    const make=(cur,prev,history=[],source="Calculated")=>({current:cur,previous:prev,history,source});
    const cr=make(div(ca.current,cl.current),div(ca.previous,cl.previous));
    const de=make(div((sd.current||0)+(ld.current||0),eq.current),div((sd.previous||0)+(ld.previous||0),eq.previous));
    const gm=make(div(gp.current,r.current),div(gp.previous,r.previous));
    const nm=make(div(ni.current,r.current),div(ni.previous,r.previous));
    const cc=make(div(ocf.current,ni.current),div(ocf.previous,ni.previous));
    const metrics={revenue:r,grossProfit:gp,netIncome:ni,operatingCashFlow:ocf,currentAssets:ca,currentLiabilities:cl,debt:make((sd.current||0)+(ld.current||0),(sd.previous||0)+(ld.previous||0)),equity:eq,currentRatio:cr,debtEquity:de,grossMargin:gm,netMargin:nm,cashConversion:cc};

    const liquidity=status(cr.current,1,Infinity,{low:"Current liabilities exceed current assets.",high:"",ok:"Current assets exceed current liabilities."});
    const leverage=status(de.current,-Infinity,2,{low:"",high:"Debt is more than twice reported equity.",ok:"Debt does not exceed twice reported equity."});
    const cash=!n(ocf.current)?["N/A — insufficient information","Operating cash flow was not reliably identified."]:ocf.current<0?["Requires attention","Reported operating cash flow is negative."]:["Stable","Reported operating cash flow is positive."];
    const profit=!n(nm.current)?["N/A — insufficient information","Revenue or net income was not reliably identified."]:nm.current<0?["Requires attention","Reported net income is negative relative to revenue."]:["Stable","Reported net income is positive relative to revenue."];
    const concern=p.goingConcern.findings.length?["Review required","Potential disclosure language was identified in the filing."]:["No explicit indicator identified","No explicit going-concern phrase was identified by automated text review."];

    const yoy=pct(r.current,r.previous),marginMove=n(gm.current)&&n(gm.previous)?gm.current-gm.previous:null,netMove=n(nm.current)&&n(nm.previous)?nm.current-nm.previous:null;
    const investor=[
      n(yoy)?`Revenue ${yoy>=0?"increased":"decreased"} ${Math.abs(yoy*100).toFixed(1)}% versus the identified prior period.`:"Revenue trajectory: N/A — insufficient information in uploaded filing.",
      n(gm.current)?`Gross margin was ${(gm.current*100).toFixed(1)}%. Gross profit is marked ${gp.source.toLowerCase()}.`:"Gross profit and gross margin: N/A — insufficient information.",
      n(nm.current)?`Net margin was ${(nm.current*100).toFixed(1)}%.`:"Net profitability: N/A — insufficient information.",
      n(marginMove)?`Gross margin ${marginMove>=0?"expanded":"contracted"} ${Math.abs(marginMove*100).toFixed(1)} percentage points.`:"Margin trend: N/A — insufficient information.",
      n(netMove)?`Net margin ${netMove>=0?"expanded":"contracted"} ${Math.abs(netMove*100).toFixed(1)} percentage points.`:"Net-margin trend: N/A — insufficient information.",
      n(cc.current)?`Operating cash flow represented ${(cc.current*100).toFixed(1)}% of reported net income.`:"Earnings quality: N/A — insufficient information.",
      `Liquidity: ${liquidity[1]}`,
      `Leverage: ${leverage[1]}`,
      `Going concern: ${concern[1]}`,
      "Investor takeaway: review this automated analysis alongside the complete filing, notes, and management discussion; it is not investment advice."
    ];
    return {...p,metrics,risks:[{title:"Liquidity",status:liquidity[0],reason:liquidity[1]},{title:"Leverage",status:leverage[0],reason:leverage[1]},{title:"Cash generation",status:cash[0],reason:cash[1]},{title:"Profitability",status:profit[0],reason:profit[1]},{title:"Going concern",status:concern[0],reason:concern[1]}],investor};
  }
  window.ForgeAnalyzer={analyze};
})(window);
