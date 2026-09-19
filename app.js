(function(){
  "use strict";
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],state={user:"",analysis:null};
  const money=x=>Number.isFinite(x)?`${x<0?"-":""}$${Math.abs(x)>=1e9?(Math.abs(x)/1e9).toFixed(2)+"B":Math.abs(x)>=1e6?(Math.abs(x)/1e6).toFixed(2)+"M":Math.abs(x)>=1e3?(Math.abs(x)/1e3).toFixed(1)+"K":Math.abs(x).toLocaleString()}`:"N/A";
  const ratio=x=>Number.isFinite(x)?`${x.toFixed(2)}x`:"N/A",percent=x=>Number.isFinite(x)?`${(x*100).toFixed(1)}%`:"N/A";
  const change=(a,b,pp=false)=>!Number.isFinite(a)||!Number.isFinite(b)?"No prior-period comparison":`${a>=b?"↑":"↓"} ${Math.abs((pp?a-b:(a-b)/Math.abs(b))*100).toFixed(1)}${pp?" pp":"%"}`;
  const card=(name,value,detail)=>`<article class="card"><small>${name}</small><strong>${value}</strong><span>${detail}</span></article>`;
  const panel=(title,body)=>`<article class="panel"><h3>${title}</h3>${body}</article>`;

  document.addEventListener("DOMContentLoaded",()=>{
    state.user=localStorage.getItem("forge_user")||"";if(state.user){show("workspaceScreen");user();}bind();
  });

  function bind(){
    $("#enterForgeBtn").onclick=()=>{const x=$("#userName").value.trim();if(!x)return $("#nameError").textContent="Enter your name to continue.";state.user=x;localStorage.setItem("forge_user",x);user();show("workspaceScreen");};
    $("#browseFilesBtn").onclick=e=>{e.stopPropagation();$("#fileInput").click();};
    $("#dropZone").onclick=()=>$("#fileInput").click();
    $("#fileInput").onchange=e=>e.target.files[0]&&run(e.target.files[0]);
    $("#dropZone").ondragover=e=>e.preventDefault();
    $("#dropZone").ondrop=e=>{e.preventDefault();e.dataTransfer.files[0]&&run(e.dataTransfer.files[0]);};
    $("#newAnalysisBtn").onclick=reset;$("#tryAgainBtn").onclick=reset;
    $$("#nav button").forEach(b=>b.onclick=()=>view(b.dataset.view));
    $("#settingsBtn").onclick=()=>$("#settings").classList.add("open");$("#closeSettingsBtn").onclick=()=>$("#settings").classList.remove("open");
    $("#clearHistoryBtn").onclick=()=>{localStorage.removeItem("forge_history");toast("Analysis history cleared.");};
    $("#clearCacheBtn").onclick=()=>toast("Documents are not cached by FORGE.");
    $("#resetWorkspaceBtn").onclick=()=>{localStorage.clear();location.reload();};
  }

  function user(){$("#topbarUserName").textContent=state.user;$("#settingsUserName").textContent=state.user;$("#userInitial").textContent=state.user[0].toUpperCase();}
  function show(id){$$(".screen").forEach(x=>x.classList.toggle("active",x.id===id));}
  function page(id){$$(".page").forEach(x=>x.classList.toggle("active",x.id===id));}
  function progress(x){$("#progressBar").style.width=`${x.value}%`;$("#progressText").textContent=`${Math.round(x.value)}%`;$("#analysisStep").textContent=x.step;$("#analysisDetail").textContent=x.detail||"";}

  async function run(file){
    try{
      page("analysisSection");progress({value:1,step:"Reading document",detail:file.name});
      const parsed=await ForgeParser.analyzeFile(file,progress);progress({value:85,step:"Calculating financial metrics",detail:"Calculating supported ratios and trends."});
      state.analysis=ForgeAnalyzer.analyze(parsed);progress({value:100,step:"Preparing investor brief",detail:"Analysis ready."});
      render();setTimeout(()=>page("resultsSection"),180);
    }catch(e){$("#errorMessage").textContent=e.message||"FORGE could not reliably analyse this file.";page("errorSection");}
  }

  function trend(metric){
    const values=metric.history.filter(Number.isFinite);if(values.length<2)return `<p class="muted">Trend unavailable — insufficient annual periods identified.</p>`;
    const max=Math.max(...values.map(Math.abs),1),years=state.analysis.years.slice(0,values.length).reverse();
    return `<div class="trend">${values.slice().reverse().map((v,i)=>`<div class="bar"><i style="height:${Math.max(3,Math.abs(v)/max*100)}%"></i><span>${years[i]||"Period"}</span></div>`).join("")}</div>`;
  }

  function render(){
    const a=state.analysis,m=a.metrics;
    $("#companyName").textContent=a.companyName;$("#topbarDocument").textContent=a.fileName;$("#sidebarCompany").textContent=a.companyName;
    $("#periodLabel").textContent=`${a.years.length?"Fiscal years identified: "+a.years.join(", "):"Fiscal period unavailable"} • Amounts: ${a.units.label} • ${a.sourceType}`;
    $("#sidebarPeriod").textContent=a.years[0]||"Period unavailable";

    $("#dashboard").innerHTML=`<div class="grid">${card("REVENUE",money(m.revenue.current),change(m.revenue.current,m.revenue.previous))}${card("GROSS PROFIT",money(m.grossProfit.current),`${percent(m.grossMargin.current)} margin • ${m.grossProfit.source}`)}${card("NET PROFIT",money(m.netIncome.current),`${percent(m.netMargin.current)} net margin`)}${card("OPERATING CASH FLOW",money(m.operatingCashFlow.current),`${percent(m.cashConversion.current)} of net income`)}${card("CURRENT RATIO",ratio(m.currentRatio.current),a.risks[0].status)}${card("DEBT / EQUITY",ratio(m.debtEquity.current),a.risks[1].status)}</div>${panel("TOP 10 INVESTOR OBSERVATIONS",`<ol>${a.investor.map(x=>`<li>${x}</li>`).join("")}</ol>`)}`;

    $("#revenue").innerHTML=panel("REVENUE",`${card("CURRENT REVENUE",money(m.revenue.current),change(m.revenue.current,m.revenue.previous))}${trend(m.revenue)}<p>${Number.isFinite(m.revenue.current)&&Number.isFinite(m.revenue.previous)?`Revenue ${m.revenue.current>=m.revenue.previous?"increased":"decreased"} versus the prior identified period.`:"N/A — insufficient information in uploaded filing."}</p>`);
    $("#profitability").innerHTML=panel("GROSS PROFIT AND NET PROFIT",`<div class="grid">${card("GROSS PROFIT",money(m.grossProfit.current),`${m.grossProfit.source} • Gross margin ${percent(m.grossMargin.current)}`)}${card("NET PROFIT",money(m.netIncome.current),`Net margin ${percent(m.netMargin.current)}`)}</div>${trend(m.netIncome)}<p>Gross Profit = Revenue − Cost of Revenue when not directly reported. Margin changes use percentage points.</p>`);
    $("#liquidity").innerHTML=panel("LIQUIDITY",`<div class="grid">${card("CURRENT RATIO",ratio(m.currentRatio.current),a.risks[0].status)}${card("CURRENT ASSETS",money(m.currentAssets.current),"Reported value")}${card("CURRENT LIABILITIES",money(m.currentLiabilities.current),"Reported value")}</div><p>${a.risks[0].reason} A ratio below 1.0x means current liabilities exceed current assets; interpretation also depends on the business model and operating cash flow.</p>`);
    $("#leverage").innerHTML=panel("CAPITAL STRUCTURE",`<div class="grid">${card("DEBT / EQUITY",ratio(m.debtEquity.current),change(m.debtEquity.current,m.debtEquity.previous))}${card("TOTAL DEBT",money(m.debt.current),"Short-term debt + long-term debt")}${card("EQUITY",money(m.equity.current),"Reported equity")}</div><p>${a.risks[1].reason} FORGE defines total debt as short-term borrowings plus long-term debt.</p>`);
    $("#cashflow").innerHTML=panel("CASH GENERATION",`<div class="grid">${card("OPERATING CASH FLOW",money(m.operatingCashFlow.current),change(m.operatingCashFlow.current,m.operatingCashFlow.previous))}${card("NET INCOME",money(m.netIncome.current),"Reported or extracted value")}${card("CASH CONVERSION",percent(m.cashConversion.current),"Operating cash flow ÷ net income")}</div><p>${a.risks[2].reason} When cash conversion is materially below 100%, review working-capital movements and non-cash adjustments.</p>`);
    table(a);
    $("#risk").innerHTML=panel("FINANCIAL RISK INDICATORS",`<div class="risk">${a.risks.map(r=>`<article><h3>${r.title}</h3><span class="tag ${/attention|review/i.test(r.status)?"warn":"good"}">${r.status}</span><p class="muted">${r.reason}</p></article>`).join("")}</div>`);
    $("#goingConcern").innerHTML=panel("GOING-CONCERN REVIEW",`<span class="tag ${a.goingConcern.findings.length?"warn":"good"}">${a.goingConcern.status}</span>${a.goingConcern.findings.length?`<h3>Extracted evidence</h3><ul>${a.goingConcern.findings.map(x=>`<li>${x}</li>`).join("")}</ul>`:"<p>No explicit going-concern phrase was identified in the extracted text.</p>"}<p class="muted">This is automated document analysis, not an audit or professional going-concern opinion.</p>`);
    $("#investor").innerHTML=panel("INVESTOR ANALYSIS — 10 THINGS TO KNOW",`<ol>${a.investor.map(x=>`<li>${x}</li>`).join("")}</ol><button id="exportBtn">EXPORT PDF REPORT ↓</button>`);
    $("#exportBtn").onclick=exportPDF;view("dashboard");
  }

  function table(a){
    const m=a.metrics,rows=[["Revenue",m.revenue,money,false],["Gross Profit",m.grossProfit,money,false],["Net Income",m.netIncome,money,false],["Operating Cash Flow",m.operatingCashFlow,money,false],["Gross Margin",m.grossMargin,percent,true],["Net Margin",m.netMargin,percent,true],["Current Ratio",m.currentRatio,ratio,false],["Debt / Equity",m.debtEquity,ratio,false],["OCF / Net Income",m.cashConversion,percent,true]];
    $("#statistics").innerHTML=panel("FINANCIAL STATISTICS",`<table><thead><tr><th>Metric</th><th>${a.years[0]||"Current"}</th><th>${a.years[1]||"Previous"}</th><th>Change</th></tr></thead><tbody>${rows.map(([n,x,f,pp])=>`<tr><td>${n}${x.source==="Calculated"?" (Calculated)":""}</td><td>${f(x.current)}</td><td>${f(x.previous)}</td><td>${change(x.current,x.previous,pp)}</td></tr>`).join("")}</tbody></table>`);
  }

  function view(id){$$(".view").forEach(x=>x.classList.toggle("active",x.id===id));$$("#nav button").forEach(x=>x.classList.toggle("active",x.dataset.view===id));}
  function reset(){$("#fileInput").value="";page("uploadSection");}
  function toast(x){$("#toast").textContent=x;$("#toast").classList.add("show");setTimeout(()=>$("#toast").classList.remove("show"),2200);}
  function exportPDF(){
    if(!window.jspdf)return toast("PDF export library did not load.");
    const a=state.analysis,{jsPDF}=window.jspdf,pdf=new jsPDF(),m=a.metrics;
    pdf.setFontSize(18);pdf.text("FORGE Financial Intelligence Brief",40,45);pdf.setFontSize(10);pdf.text(`${a.companyName} — ${a.fileName}`,40,64);
    pdf.autoTable({startY:80,head:[["Metric","Current","Previous"]],body:[["Revenue",money(m.revenue.current),money(m.revenue.previous)],["Gross Profit",money(m.grossProfit.current),money(m.grossProfit.previous)],["Net Income",money(m.netIncome.current),money(m.netIncome.previous)],["Operating Cash Flow",money(m.operatingCashFlow.current),money(m.operatingCashFlow.previous)],["Current Ratio",ratio(m.currentRatio.current),ratio(m.currentRatio.previous)],["Debt / Equity",ratio(m.debtEquity.current),ratio(m.debtEquity.previous)]]});
    let y=pdf.lastAutoTable.finalY+25;pdf.text("Investor observations",40,y);pdf.setFontSize(9);a.investor.forEach(x=>{y+=17;pdf.text(pdf.splitTextToSize("• "+x,500),40,y);});
    pdf.save(`FORGE_${a.companyName.replace(/\W+/g,"_")}.pdf`);
  }
})();
