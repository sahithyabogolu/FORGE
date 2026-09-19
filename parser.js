(function (window) {
  "use strict";

  const aliases = {
    revenue:["total revenues","total revenue","net revenues","net revenue","net sales","total sales","revenues","revenue","sales"],
    grossProfit:["gross profit"],
    costOfRevenue:["cost of revenues","cost of revenue","cost of sales","cost of goods sold"],
    netIncome:["net income","net earnings","net profit","profit for the year","income attributable to"],
    operatingCashFlow:["net cash provided by operating activities","cash provided by operating activities","net cash from operating activities"],
    currentAssets:["total current assets","current assets"],
    currentLiabilities:["total current liabilities","current liabilities"],
    shortDebt:["short-term debt","short term debt","current portion of long-term debt","current maturities of long-term debt"],
    longDebt:["long-term debt","long term debt","long-term borrowings","long term borrowings"],
    equity:["total stockholders' equity","total shareholders' equity","total equity","shareholders' equity","stockholders' equity"]
  };

  const clean = text => String(text || "").replace(/\u00a0/g," ").replace(/\r/g,"").replace(/[ \t]+/g," ").trim();
  const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const report = (fn,value,step,detail) => fn && fn({value,step,detail});
  const number = token => {
    let x=String(token).replace(/[$€£¥,%†‡*]/g,"").replace(/,/g,"").trim(), negative=/^\(.*\)$/.test(x);
    x=x.replace(/[()]/g,"");
    return /^\d*\.?\d+$/.test(x) ? Number(x)*(negative?-1:1) : null;
  };
  const nums = line => (String(line).match(/\(?[$€£¥]?\d[\d,]*(?:\.\d+)?\)?[†‡*]?/g)||[]).map(number).filter(Number.isFinite);

  function unitInfo(text) {
    const head=text.slice(0,35000).toLowerCase();
    if(/\bin billions?\b/.test(head)) return {label:"Billions",multiplier:1e9};
    if(/\bin millions?\b/.test(head)) return {label:"Millions",multiplier:1e6};
    if(/\bin thousands?\b/.test(head)) return {label:"Thousands",multiplier:1e3};
    return {label:"As reported",multiplier:1};
  }

  function years(text) {
    return [...new Set((text.match(/\b(?:19|20)\d{2}\b/g)||[]).map(Number))].filter(y=>y>=1990&&y<=new Date().getFullYear()+1).sort((a,b)=>b-a).slice(0,5);
  }

  function metric(text,key,units) {
    const candidates=[];
    text.split("\n").map(clean).filter(Boolean).forEach(line=>{
      const lower=line.toLowerCase();
      const matched=aliases[key].find(term=>new RegExp(`(^|\\W)${esc(term)}(\\W|$)`,"i").test(lower));
      const values=nums(line);
      if(!matched||!values.length)return;
      const around=text.slice(Math.max(0,text.indexOf(line)-2300),text.indexOf(line)+2300).toLowerCase();
      let score=matched.length+(around.includes("consolidated statements")?40:0)+(around.includes("years ended")?10:0);
      if(/segment|quarter|three months|note \d/.test(lower))score-=20;
      candidates.push({values:values.slice(0,5).map(v=>v*units.multiplier),score,evidence:line});
    });
    candidates.sort((a,b)=>b.score-a.score);
    const best=candidates[0];
    return best ? {values:best.values,source:"Reported",evidence:best.evidence,confidence:best.score>=45?"Statement context":"Context uncertain"} : {values:[],source:"N/A",evidence:"",confidence:"Unavailable"};
  }

  function concern(text) {
    const matches=[];
    [/substantial doubt.{0,350}/ig,/going concern.{0,350}/ig,/material uncertainty.{0,350}/ig,/covenant (?:breach|violation).{0,250}/ig,/liquidity (?:shortfall|constraint|risk).{0,250}/ig].forEach(re=>{
      const hit=re.exec(text);if(hit)matches.push(clean(hit[0]));
    });
    return {findings:[...new Set(matches)].slice(0,3),status:matches.length?"Potential disclosure identified":"No explicit disclosure identified"};
  }

  async function extract(file,progress) {
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    report(progress,8,"Reading document",file.name);
    if(ext==="pdf"){
      if(!window.pdfjsLib)throw Error("PDF.js did not load.");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,pages=[];
      for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),c=await p.getTextContent();pages.push(c.items.map(x=>x.str).join(" "));report(progress,8+42*i/pdf.numPages,"Extracting financial tables",`Reading page ${i} of ${pdf.numPages}`);}
      const text=clean(pages.join("\n"));if(text.length<200)throw Error("No extractable text was found. This may be an image-only or scanned PDF.");
      return {text,type:"PDF"};
    }
    if(ext==="docx"){if(!window.mammoth)throw Error("Mammoth did not load.");const text=clean((await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value);if(text.length<80)throw Error("The DOCX contains too little readable text.");return {text,type:"DOCX"};}
    if(["xlsx","xls"].includes(ext)){if(!window.XLSX)throw Error("SheetJS did not load.");const wb=window.XLSX.read(await file.arrayBuffer(),{type:"array"});return {text:clean(wb.SheetNames.map(n=>window.XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n")),type:"Spreadsheet"};}
    if(["csv","txt","html","htm"].includes(ext)){let text=await file.text();if(ext==="html"||ext==="htm")text=new DOMParser().parseFromString(text,"text/html").body.textContent;return {text:clean(text),type:ext.toUpperCase()};}
    throw Error("Unsupported file type.");
  }

  async function analyzeFile(file,progress) {
    const data=await extract(file,progress),units=unitInfo(data.text);
    report(progress,55,"Identifying fiscal periods","Locating annual statement context.");
    const metrics={};for(const key of Object.keys(aliases))metrics[key]=metric(data.text,key,units);
    const a=metrics.revenue.values,b=metrics.grossProfit.values,c=metrics.costOfRevenue.values;
    if(!a.length&&b.length&&c.length)metrics.revenue={values:b.map((v,i)=>v+(c[i]||0)),source:"Calculated",evidence:"Gross profit + cost of revenue",confidence:"Derived"};
    if(!b.length&&a.length&&c.length)metrics.grossProfit={values:a.map((v,i)=>v-(c[i]||0)),source:"Calculated",evidence:"Revenue − cost of revenue",confidence:"Derived"};
    report(progress,78,"Normalising financial data",`Amounts interpreted as ${units.label.toLowerCase()}.`);
    const candidate=data.text.slice(0,6000).match(/\b[A-Z][A-Z ,. '&-]{4,70}\b/);
    return {fileName:file.name,companyName:candidate?clean(candidate[0]):file.name.replace(/\.[^.]+$/,""),sourceType:data.type,years:years(data.text),units,metrics,goingConcern:concern(data.text),analyzedAt:new Date().toISOString()};
  }
  window.ForgeParser={analyzeFile};
})(window);
