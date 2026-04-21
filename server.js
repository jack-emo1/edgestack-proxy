const express = require("express");
const cors = require("cors");
const app = express();
 
app.use(cors());
app.use(express.json());
 
const ODDS_API_KEY = process.env.ODDS_API_KEY || "ca6d6693352b4b3e3ea11856734a9870";
const ODDS_BASE = "https://api.the-odds-api.com/v4";
 
app.get("/api/odds/:sport", async (req, res) => {
  try {
    const { sport } = req.params;
    const { regions = "us,au,uk", markets = "h2h,spreads,totals", oddsFormat = "american" } = req.query;
    const url = `${ODDS_BASE}/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}`;
    const response = await fetch(url);
    const data = await response.json();
    const remaining = response.headers.get("x-requests-remaining");
    if (remaining) res.set("x-requests-remaining", remaining);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
app.get("/api/health", (req, res) => res.json({ status: "EDGE//STACK Online" }));
 
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>EDGE//STACK</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#080B14;color:#E8EAF0;font-family:'Courier New',monospace;min-height:100vh}
.bg{position:fixed;inset:0;background-image:linear-gradient(rgba(255,107,53,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,107,53,.02) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
.wrap{position:relative;z-index:1;max-width:860px;margin:0 auto;padding:0 14px 90px}
.hdr{padding:18px 0 12px;border-bottom:1px solid rgba(255,107,53,.12);display:flex;align-items:center;gap:12px}
.logo{width:32px;height:32px;background:linear-gradient(135deg,#FF6B35,#F0A500);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#080B14;flex-shrink:0}
.tabs{display:flex;gap:2px;padding:8px 0 12px;overflow-x:auto}
.tab{background:transparent;border:1px solid transparent;color:#374151;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:9px;letter-spacing:2px;font-family:inherit;white-space:nowrap;transition:all .15s}
.tab.on{background:rgba(255,107,53,.1);border-color:rgba(255,107,53,.4);color:#FF6B35}
.card{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px;margin-bottom:10px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.lbl{font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:5px;display:block}
input,select{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;color:#E8EAF0;padding:8px 10px;font-size:12px;font-family:inherit;box-sizing:border-box;outline:none}
select{background:#0D1119}
.btn{border:none;border-radius:6px;cursor:pointer;font-size:10px;letter-spacing:2px;font-family:inherit;padding:7px 14px;white-space:nowrap}
.o{background:rgba(255,107,53,.18);border:1px solid rgba(255,107,53,.44);color:#FF6B35}
.tc{background:rgba(78,205,196,.18);border:1px solid rgba(78,205,196,.44);color:#4ECDC4}
.r{background:rgba(255,71,87,.18);border:1px solid rgba(255,71,87,.44);color:#FF4757}
.prim{background:linear-gradient(135deg,#FF6B35,#F0A500);color:#080B14;font-weight:700;width:100%;padding:10px;margin-top:10px;font-size:11px}
.bar{position:fixed;bottom:0;left:0;right:0;background:rgba(8,11,20,.96);border-top:1px solid rgba(255,107,53,.1);padding:8px 16px;display:flex;justify-content:space-between;align-items:center;z-index:10}
.hidden{display:none!important}
input[type=range]{accent-color:#FF6B35}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:rgba(255,107,53,.3);border-radius:2px}
</style>
</head>
<body>
<div class="bg"></div>
<div class="wrap">
  <div class="hdr">
    <div class="logo">E</div>
    <div>
      <div style="font-size:14px;font-weight:700;letter-spacing:3px;color:#FF6B35">EDGE//STACK</div>
      <div style="font-size:9px;color:#1F2937;letter-spacing:2px">AU · NFL · NBA · AFL · AI POWERED</div>
    </div>
    <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
      <span style="font-size:9px;color:#4ECDC4">BK $</span>
      <input id="bk" type="number" value="1000" style="width:75px;background:rgba(78,205,196,.07);border:1px solid rgba(78,205,196,.2);color:#4ECDC4;font-weight:700;text-align:right" onchange="S.bankroll=parseFloat(this.value)||0;uBar()">
    </div>
  </div>
  <div class="tabs" id="tabs"></div>
  <div id="pg"></div>
</div>
<div class="bar">
  <span style="font-size:9px;color:#1F2937;letter-spacing:1px">EDGE//STACK · AU · AI · LIVE</span>
  <div style="display:flex;gap:12px">
    <span id="b-wr" style="font-size:9px"></span>
    <span id="b-clv" style="font-size:9px"></span>
    <span id="b-bk" style="font-size:9px;color:#FF6B35"></span>
    <span id="b-lim" style="font-size:9px"></span>
  </div>
</div>
 
<script>
const BOOKS=[
  {k:"pinnacle",l:"Pinnacle",t:"SHARP",c:"#4ECDC4"},
  {k:"sportsbet",l:"Sportsbet",t:"SOFT",c:"#FF6B35"},
  {k:"ladbrokes",l:"Ladbrokes",t:"SOFT",c:"#FF6B35"},
  {k:"neds",l:"Neds",t:"SOFT",c:"#FF6B35"},
  {k:"tab",l:"TAB",t:"SEMI",c:"#F0A500"},
  {k:"betnation",l:"BetNation",t:"SOFT",c:"#FF6B35"},
];
const MB=["sportsbet","neds","tab","betnation"];
const SC={NBA:"#FF6B35",NFL:"#4ECDC4",AFL:"#00A86B"};
const SK={NBA:"basketball_nba",NFL:"americanfootball_nfl",AFL:"aussierules_afl"};
 
const S={
  tab:"dashboard",bankroll:1000,kf:.5,
  bets:[
    {id:1,date:"2024-01-15",sport:"NBA",game:"Lakers vs Celtics",pick:"Lakers -3.5",betOdds:-110,closingOdds:-115,result:"W",stake:27.5,bk:"sportsbet"},
    {id:2,date:"2024-01-16",sport:"NFL",game:"Chiefs vs Ravens",pick:"Over 47.5",betOdds:-108,closingOdds:-112,result:"L",stake:27.5,bk:"ladbrokes"},
    {id:3,date:"2024-01-17",sport:"NBA",game:"Warriors vs Suns",pick:"Warriors +2",betOdds:-105,closingOdds:-110,result:"W",stake:28,bk:"pinnacle"},
    {id:4,date:"2024-01-18",sport:"AFL",game:"Collingwood vs Richmond",pick:"Collingwood -9.5",betOdds:-110,closingOdds:-118,result:"W",stake:27,bk:"sportsbet"},
    {id:5,date:"2024-01-20",sport:"NBA",game:"Bucks vs Heat",pick:"Giannis O 32.5",betOdds:-112,closingOdds:-120,result:"W",stake:27.25,bk:"neds"},
    {id:6,date:"2024-01-21",sport:"NFL",game:"49ers vs Packers",pick:"49ers -6.5",betOdds:-110,closingOdds:-108,result:"W",stake:27.5,bk:"tab"},
    {id:7,date:"2024-01-22",sport:"AFL",game:"Geelong vs Hawthorn",pick:"Under 164.5",betOdds:-106,closingOdds:-110,result:"L",stake:27.75,bk:"betnation"},
  ],
  limits:[{id:1,bk:"sportsbet",orig:100,curr:20,date:"2024-01-10",notes:"Limited after winning run"}],
  odds:[],aOdds:[],aRes:{},selGame:null,mOdds:{},
  legs:[{id:1,pick:"",odds:-110,wp:55},{id:2,pick:"",odds:-110,wp:55}],
  aSport:"AFL",oSport:"AFL",
};
 
function a2d(o){if(!o)return 1;return o>0?o/100+1:100/Math.abs(o)+1;}
function a2i(o){return(1/a2d(o))*100;}
function fo(o){if(!o)return"—";return o>0?"+"+o:""+o;}
function cv(b,c){if(!b||!c)return 0;return a2i(c)-a2i(b);}
function kl(p,o){const b=a2d(o)-1,q=1-p/100;return Math.max(0,((b*p/100-q)/b)*100);}
function bl(k){return BOOKS.find(b=>b.k===k)?.l||k;}
function settled(){return S.bets.filter(b=>b.result!=="P");}
function sts(){
  const s=settled();
  const w=s.filter(b=>b.result==="W").length;
  const wr=s.length?w/s.length*100:0;
  const p=s.reduce((a,b)=>b.result==="W"?a+b.stake*(a2d(b.betOdds)-1):b.result==="L"?a-b.stake:a,0);
  const ac=s.reduce((a,b)=>a+cv(b.betOdds,b.closingOdds),0)/(s.length||1);
  const cr=s.length?s.filter(b=>cv(b.betOdds,b.closingOdds)>0).length/s.length*100:0;
  return{s,w,wr,p,ac,cr};
}
function uBar(){
  const {wr,p,ac}=sts();
  const q=id=>document.getElementById(id);
  q("b-wr")&&(q("b-wr").textContent="WIN "+wr.toFixed(1)+"%",q("b-wr").style.color=wr>=52.4?"#4ECDC4":"#FF4757");
  q("b-clv")&&(q("b-clv").textContent="CLV "+(ac>=0?"+":"")+ac.toFixed(2)+"%",q("b-clv").style.color=ac>=0?"#4ECDC4":"#FF4757");
  q("b-bk")&&(q("b-bk").textContent="BK $"+S.bankroll.toFixed(0));
  q("b-lim")&&(q("b-lim").textContent=S.limits.length+" LIMITED",q("b-lim").style.color=S.limits.length?"#FF4757":"#374151");
}
 
const TABS=[
  {id:"dashboard",icon:"⬡",label:"Dashboard"},
  {id:"tracker",icon:"◈",label:"Tracker"},
  {id:"analysis",icon:"◎",label:"AI Analysis"},
  {id:"multi",icon:"◇",label:"Multi EV"},
  {id:"kelly",icon:"△",label:"Kelly"},
  {id:"clv",icon:"▷",label:"CLV"},
  {id:"odds",icon:"◉",label:"Live Odds"},
  {id:"books",icon:"▣",label:"Books"},
  {id:"settings",icon:"⚙",label:"Settings"},
];
 
function renderTabs(){
  document.getElementById("tabs").innerHTML=TABS.map(t=>
    `<button class="tab${S.tab===t.id?" on":""}" onclick="goTab('${t.id}')">${t.icon} ${t.label}</button>`
  ).join("");
}
 
function goTab(id){
  S.tab=id;
  renderTabs();
  renderPage();
  if(id==="analysis"&&S.aOdds.length===0) fetchOdds(S.aSport,"aOdds");
  if(id==="odds"&&S.odds.length===0) fetchOdds(S.oSport,"odds");
}
 
async function fetchOdds(sport,target){
  document.getElementById("pg").innerHTML=`<div style="text-align:center;padding:50px;color:#374151">Fetching ${sport} odds···</div>`;
  try{
    const r=await fetch("/api/odds/"+SK[sport]+"?regions=us,au,uk&markets=h2h,spreads,totals&oddsFormat=american");
    if(!r.ok) throw new Error("API error "+r.status);
    S[target]=await r.json();
    const rem=r.headers.get("x-requests-remaining");
    S.remReq=rem;
  }catch(e){
    S[target]=[];
    S.oddsErr=e.message;
  }
  renderPage();
}
 
async function runAnalysis(gid){
  const g=S.aOdds.find(x=>x.id===gid);
  if(!g)return;
  S.aRes[gid]="LOADING";
  renderPage();
  try{
    const pH=g.bookmakers?.find(b=>b.key==="pinnacle")?.markets?.find(m=>m.key==="h2h");
    const pS=g.bookmakers?.find(b=>b.key==="pinnacle")?.markets?.find(m=>m.key==="spreads");
    const pT=g.bookmakers?.find(b=>b.key==="pinnacle")?.markets?.find(m=>m.key==="totals");
    const oc=[
      pH?"H2H: "+pH.outcomes?.map(o=>o.name+" "+fo(o.price)).join(" / "):null,
      pS?"Spread: "+pS.outcomes?.map(o=>o.name+" "+(o.point>0?"+":"")+o.point+" "+fo(o.price)).join(" / "):null,
      pT?"Total: "+pT.outcomes?.map(o=>o.name+" "+o.point+" "+fo(o.price)).join(" / "):null,
    ].filter(Boolean).join("\\n")||"No Pinnacle odds";
    const prompt=`You are a sharp professional sports betting analyst specialising in Australian betting markets.
 
GAME: ${g.away_team} @ ${g.home_team}
DATE: ${new Date(g.commence_time).toLocaleDateString("en-AU")}
SPORT: ${S.aSport}
 
PINNACLE ODDS:
${oc}
 
Using your knowledge of these teams provide:
 
EDGE ASSESSMENT: [Value on either side? Which market?]
 
KEY FACTORS:
- [Factor 1]
- [Factor 2]
- [Factor 3]
 
RECOMMENDED BET: [Pick, market, which AU book, confidence Low/Medium/High]
 
CLV EXPECTATION: [Will line move in your favour?]
 
MULTI POTENTIAL: [Good multi leg or too risky?]
 
VERDICT: [One sentence. No hedging.]`;
    const r=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})
    });
    const d=await r.json();
    S.aRes[gid]=d.content?.find(c=>c.type==="text")?.text||"No analysis returned";
  }catch(e){S.aRes[gid]="Error: "+e.message;}
  renderPage();
}
 
function addBet(){
  const g=id=>document.getElementById("nb-"+id);
  S.bets.push({
    id:Date.now(),date:g("date").value,sport:g("sport").value,game:g("game").value,
    pick:g("pick").value,betOdds:parseInt(g("betOdds").value)||0,
    closingOdds:parseInt(g("closingOdds").value)||0,result:g("result").value,
    bk:g("bk").value,stake:parseFloat((S.bankroll*kl(55,-110)*S.kf/100).toFixed(2)),
  });
  uBar();goTab("tracker");
}
 
function addLimit(){
  S.limits.push({id:Date.now(),bk:document.getElementById("nl-bk").value,orig:parseFloat(document.getElementById("nl-orig").value)||0,curr:parseFloat(document.getElementById("nl-curr").value)||0,date:document.getElementById("nl-date").value,notes:document.getElementById("nl-notes").value});
  uBar();renderPage();
}
 
function mCalc(){
  const l=S.legs.filter(x=>x.odds&&x.wp>0);
  if(l.length<2)return null;
  const d=l.reduce((a,x)=>a*a2d(x.odds),1);
  const p=l.reduce((a,x)=>a*(x.wp/100),1)*100;
  const ev=(p/100)*(d-1)-(1-p/100);
  const am=d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));
  return{d,p,ev,am,allPos:l.every(x=>(x.wp-a2i(x.odds))>0),n:l.length};
}
 
function card(content,extra=""){return`<div class="card" ${extra}>${content}</div>`;}
function metric(label,value,sub,color){return`<div class="card" style="position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,${color},transparent)"></div><div style="font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:4px">${label}</div><div style="font-size:22px;font-weight:900;color:${color};line-height:1">${value}</div><div style="font-size:10px;color:#4A5568;margin-top:4px">${sub}</div></div>`;}
function miniCard(label,value,color){return`<div class="card" style="text-align:center;padding:12px"><div style="font-size:9px;color:#374151;margin-bottom:5px">${label}</div><div style="font-size:16px;font-weight:900;color:${color}">${value}</div></div>`;}
function progRow(label,val,threshold,max){const c=val>=threshold?"#4ECDC4":"#FF4757";return`<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:10px;color:#4A5568;margin-bottom:4px"><span>${label}</span><span style="color:${c}">${val.toFixed(1)}%</span></div><div style="height:3px;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.min(val/max*100,100)}%;background:${c};border-radius:3px"></div></div></div>`;}
 
function renderPage(){
  const pg=document.getElementById("pg");
  const {s,w,wr,p,ac,cr}=sts();
  const t=S.tab;
 
  if(t==="dashboard"){
    const bh=[S.bankroll];
    [...s].sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(b=>{
      const l=bh[bh.length-1];
      bh.push(b.result==="W"?l+b.stake*(a2d(b.betOdds)-1):b.result==="L"?l-b.stake:l);
    });
    const mn=Math.min(...bh),mx=Math.max(...bh),rng=mx-mn||1;
    const pts=bh.map((v,i)=>((i/(bh.length-1))*200)+","+(40-((v-mn)/rng)*40)).join(" ");
    const col=p>=0?"#4ECDC4":"#FF4757";
    pg.innerHTML=`
    <div class="g2" style="margin-bottom:12px">
      ${metric("WIN RATE",wr.toFixed(1)+"%",w+"W · "+(s.length-w)+"L",wr>=52.4?"#4ECDC4":"#FF4757")}
      ${metric("PROFIT",(p>=0?"+":"")+"$"+p.toFixed(0),(p/(S.bankroll*.0275)).toFixed(1)+" units",p>=0?"#FF6B35":"#FF4757")}
      ${metric("AVG CLV",(ac>=0?"+":"")+ac.toFixed(2)+"%",cr.toFixed(0)+"% positive",ac>=0?"#4ECDC4":"#FF4757")}
      ${metric("BETS",s.length,S.bets.filter(b=>b.result==="P").length+" pending","#F0A500")}
    </div>
    ${card(`<div style="font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:8px">◈ BANKROLL GROWTH</div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#4A5568;margin-bottom:6px"><span>Start: $${bh[0].toFixed(0)}</span><span style="color:${col}">Now: $${bh[bh.length-1].toFixed(0)}</span></div>
      <svg viewBox="0 0 200 40" style="width:100%;height:48px" preserveAspectRatio="none">
        <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/>
        <polyline points="0,40 ${pts} 200,40" fill="${col}12" stroke="none"/>
      </svg>`,"style='margin-bottom:12px'")}
    <div style="background:rgba(255,107,53,.03);border:1px solid rgba(255,107,53,.12);border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:10px">◎ EDGE HEALTH</div>
      ${progRow("Win Rate vs Breakeven 52.4%",wr,52.4,65)}
      ${progRow("CLV Positive Rate",cr,50,100)}
      ${progRow("Sample Confidence (1000+ target)",Math.min(s.length/10,100),50,100)}
    </div>
    ${card(`<div style="font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:0;border-bottom:1px solid rgba(255,255,255,.05);padding-bottom:10px;margin:0 -16px 0;padding:10px 16px 10px">RECENT BETS</div>
    ${S.bets.slice(-6).reverse().map(b=>{const c2=cv(b.betOdds,b.closingOdds);return`<div style="display:flex;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.03);gap:10px"><div style="width:5px;height:5px;border-radius:50%;background:${b.result==="W"?"#4ECDC4":b.result==="L"?"#FF4757":"#F0A500"};flex-shrink:0"></div><span style="font-size:9px;color:${SC[b.sport]||"#FF6B35"};width:34px;flex-shrink:0">${b.sport}</span><span style="flex:1;font-size:11px;color:#9CA3AF;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.pick}</span><span style="font-size:9px;color:#374151;flex-shrink:0">${bl(b.bk)}</span><span style="font-size:10px;color:${c2>0?"#4ECDC4":"#FF4757"};flex-shrink:0">${c2>0?"+":""}${c2.toFixed(1)}%</span><span style="font-size:11px;font-weight:700;color:${b.result==="W"?"#4ECDC4":b.result==="L"?"#FF4757":"#F0A500"};width:16px;text-align:center">${b.result}</span></div>`;}).join("")}`,"style='padding:0 16px'")}`;
  }
 
  else if(t==="tracker"){
    pg.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:9px;color:#374151;letter-spacing:2px">${S.bets.length} BETS LOGGED</div>
      <button class="btn o" onclick="document.getElementById('abf').classList.toggle('hidden')">+ LOG BET</button>
    </div>
    <div id="abf" class="hidden" style="background:rgba(255,107,53,.03);border:1px solid rgba(255,107,53,.15);border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:10px">NEW BET</div>
      <div class="g2">
        <div><label class="lbl">DATE</label><input type="date" id="nb-date"></div>
        <div><label class="lbl">GAME</label><input type="text" id="nb-game" placeholder="Team A vs B"></div>
        <div><label class="lbl">PICK</label><input type="text" id="nb-pick" placeholder="e.g. Lakers -3.5"></div>
        <div><label class="lbl">BET ODDS</label><input type="number" id="nb-betOdds" value="-110"></div>
        <div><label class="lbl">CLOSING ODDS</label><input type="number" id="nb-closingOdds" value="-110"></div>
        <div><label class="lbl">SPORT</label><select id="nb-sport"><option>AFL</option><option>NBA</option><option>NFL</option></select></div>
        <div><label class="lbl">BOOKMAKER</label><select id="nb-bk">${BOOKS.map(b=>`<option value="${b.k}">${b.l}</option>`).join("")}</select></div>
        <div><label class="lbl">RESULT</label><select id="nb-result"><option value="P">Pending</option><option value="W">Win</option><option value="L">Loss</option></select></div>
      </div>
      <button class="btn prim" onclick="addBet()">LOG BET</button>
    </div>
    ${S.bets.slice().reverse().map(b=>{
      const c2=cv(b.betOdds,b.closingOdds);
      const pnl=b.result==="W"?b.stake*(a2d(b.betOdds)-1):b.result==="L"?-b.stake:0;
      const li=S.limits.find(l=>l.bk===b.bk);
      return card(`<div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <div>
          <div style="display:flex;gap:6px;margin-bottom:3px;flex-wrap:wrap">
            <span style="font-size:9px;color:${SC[b.sport]||"#FF6B35"}">${b.sport}</span>
            <span style="font-size:9px;color:#374151">${b.date}</span>
            <span style="font-size:9px;color:${BOOKS.find(x=>x.k===b.bk)?.c||"#6B7280"}">${bl(b.bk)}</span>
            ${li?`<span style="font-size:9px;color:#FF4757;background:rgba(255,71,87,.1);padding:1px 5px;border-radius:3px">LIMITED $${li.curr}</span>`:""}
          </div>
          <div style="font-size:13px;font-weight:600">${b.pick}</div>
          <div style="font-size:10px;color:#4A5568">${b.game}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:15px;font-weight:900;color:${b.result==="W"?"#4ECDC4":b.result==="L"?"#FF4757":"#F0A500"}">${b.result==="P"?"PENDING":(pnl>=0?"+":"")+"$"+pnl.toFixed(2)}</div>
          <div style="font-size:9px;color:#374151">stake $${b.stake.toFixed(2)}</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;font-size:10px">
        <span style="color:#4A5568">Bet <span style="color:#E8EAF0">${fo(b.betOdds)}</span></span>
        <span style="color:#4A5568">Close <span style="color:#E8EAF0">${fo(b.closingOdds)}</span></span>
        <span style="color:${c2>0?"#4ECDC4":"#FF4757"}">CLV ${c2>0?"+":""}${c2.toFixed(2)}%</span>
      </div>`,`style="border-color:${b.result==="W"?"rgba(78,205,196,.15)":b.result==="L"?"rgba(255,71,87,.15)":"rgba(240,165,0,.15)"};margin-bottom:8px"`);
    }).join("")}`;
  }
 
  else if(t==="analysis"){
    pg.innerHTML=`
    <div style="padding:10px 14px;background:rgba(78,205,196,.05);border:1px solid rgba(78,205,196,.14);border-radius:10px;font-size:11px;color:#4ECDC4;margin-bottom:14px;line-height:1.6">
      ◎ Claude analyses each game using live Pinnacle odds + deep knowledge of team form, stats and matchup history.
    </div>
    <div style="display:flex;gap:6px;margin-bottom:12px;align-items:center">
      ${["AFL","NBA","NFL"].map(sp=>`<button class="btn" style="background:${S.aSport===sp?SC[sp]+"18":"transparent"};border:1px solid ${S.aSport===sp?SC[sp]:"rgba(255,255,255,.07)"};color:${S.aSport===sp?SC[sp]:"#374151"}" onclick="S.aSport='${sp}';S.aOdds=[];S.aRes={};renderPage();fetchOdds('${sp}','aOdds')">${sp}</button>`).join("")}
      <button class="btn tc" style="margin-left:auto" onclick="S.aOdds=[];fetchOdds(S.aSport,'aOdds')">↻ REFRESH</button>
    </div>
    ${S.aOdds.length===0?`<div style="text-align:center;padding:40px;color:#374151">No games loaded. Select a sport and hit REFRESH.</div>`:""}
    ${S.aOdds.map(g=>{
      const gt=new Date(g.commence_time);
      const pH=g.bookmakers?.find(b=>b.key==="pinnacle")?.markets?.find(m=>m.key==="h2h");
      const res=S.aRes[g.id];
      const loading=res==="LOADING";
      return card(`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-size:9px;color:#374151;margin-bottom:3px">${gt.toLocaleDateString("en-AU")} ${gt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
            <div style="font-size:14px;font-weight:700">${g.away_team}</div>
            <div style="font-size:11px;color:#4A5568">@ ${g.home_team}</div>
            ${pH?`<div style="display:flex;gap:10px;margin-top:6px;font-size:10px;flex-wrap:wrap">${pH.outcomes?.map(o=>`<span style="color:#4ECDC4">${o.name}: <strong>${fo(o.price)}</strong></span>`).join("")}<span style="color:#374151">· Pinnacle</span></div>`:""}
          </div>
          <button class="btn o" ${loading?"disabled":""} onclick="runAnalysis('${g.id}')">${loading?"ANALYSING···":"◎ ANALYSE"}</button>
        </div>
        ${res&&res!=="LOADING"?`<div style="background:rgba(255,107,53,.04);border:1px solid rgba(255,107,53,.18);border-radius:10px;padding:14px">
          <div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:10px">AI ANALYSIS · CLAUDE</div>
          <div style="font-size:12px;color:#D1D5DB;line-height:1.9;white-space:pre-wrap">${res}</div>
          <button class="btn o" style="margin-top:12px" onclick="goTab('tracker')">+ LOG THIS BET</button>
        </div>`:""}
      `,"style='margin-bottom:12px'");
    }).join("")}`;
  }
 
  else if(t==="multi"){
    const mc=mCalc();
    pg.innerHTML=`
    <div style="padding:10px 14px;background:rgba(78,205,196,.04);border:1px solid rgba(78,205,196,.12);border-radius:10px;font-size:11px;color:#4ECDC4;margin-bottom:14px;line-height:1.6">
      ◇ Enter each leg's odds and win probability. Shows whether combining has positive expected value.
    </div>
    ${S.legs.map((leg,i)=>card(`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:10px;color:#FF6B35;letter-spacing:2px">LEG ${i+1}</div>
        ${S.legs.length>2?`<button class="btn r" style="padding:3px 8px;font-size:9px" onclick="S.legs=S.legs.filter(l=>l.id!==${leg.id});renderPage()">✕</button>`:""}
      </div>
      <div class="g3">
        <div style="grid-column:1/-1"><label class="lbl">PICK</label><input type="text" value="${leg.pick}" placeholder="e.g. Collingwood -9.5" onchange="S.legs=S.legs.map(l=>l.id===${leg.id}?{...l,pick:this.value}:l)"></div>
        <div><label class="lbl">ODDS</label><input type="number" value="${leg.odds}" style="text-align:center;font-size:14px;font-weight:700" onchange="S.legs=S.legs.map(l=>l.id===${leg.id}?{...l,odds:parseInt(this.value)||0}:l);renderPage()"></div>
        <div><label class="lbl">WIN PROB %</label><input type="number" value="${leg.wp}" style="text-align:center;font-size:14px;font-weight:700" onchange="S.legs=S.legs.map(l=>l.id===${leg.id}?{...l,wp:parseFloat(this.value)||0}:l);renderPage()"></div>
        <div><label class="lbl">LEG EDGE</label><div style="padding:8px;background:rgba(255,255,255,.03);border-radius:6px;text-align:center;font-size:13px;font-weight:700;color:${(leg.wp-a2i(leg.odds))>0?"#4ECDC4":"#FF4757"}">${(leg.wp-a2i(leg.odds))>0?"+":""}${(leg.wp-a2i(leg.odds)).toFixed(2)}%</div></div>
      </div>
    `,"style='margin-bottom:10px'")).join("")}
    <button class="btn tc" style="width:100%;margin-bottom:14px;padding:10px;text-align:center" onclick="S.legs.push({id:Date.now(),pick:'',odds:-110,wp:55});renderPage()">+ ADD LEG</button>
    ${mc?`<div style="background:${mc.ev>0?"rgba(78,205,196,.05)":"rgba(255,71,87,.05)"};border:1px solid ${mc.ev>0?"rgba(78,205,196,.2)":"rgba(255,71,87,.2)"};border-radius:12px;padding:16px">
      <div style="font-size:9px;color:${mc.ev>0?"#4ECDC4":"#FF4757"};letter-spacing:2px;margin-bottom:14px">${mc.ev>0?"✓ POSITIVE EV MULTI":"✗ NEGATIVE EV MULTI"}</div>
      <div class="g3" style="margin-bottom:14px">
        ${miniCard("COMBINED ODDS",fo(mc.am),"#FF6B35")}
        ${miniCard("WIN PROBABILITY",mc.p.toFixed(2)+"%","#F0A500")}
        ${miniCard("EXPECTED VALUE",(mc.ev>=0?"+":"")+mc.ev.toFixed(3),mc.ev>0?"#4ECDC4":"#FF4757")}
      </div>
      <div style="font-size:11px;line-height:1.7;color:${mc.ev>0?"#4ECDC4":"#FF4757"}">${mc.ev>0?"✓ Positive EV "+mc.n+"-leg multi. Max stake: $"+(S.bankroll*.01).toFixed(2)+" (1% bankroll).":"✗ "+(!mc.allPos?"One or more legs have no edge — fix first.":"Combined vig destroys edge.")+" Do not place this multi."}</div>
    </div>`:""}`;
  }
 
  else if(t==="kelly"){
    pg.innerHTML=`
    <div style="background:rgba(255,107,53,.03);border:1px solid rgba(255,107,53,.12);border-radius:12px;padding:18px;margin-bottom:12px">
      <div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:14px">△ KELLY CRITERION</div>
      <div class="g2" style="margin-bottom:14px">
        <div><label class="lbl">WIN PROBABILITY %</label><input type="number" id="kw" value="55" style="text-align:center;font-size:17px;font-weight:700;color:#FF6B35;border-color:rgba(255,107,53,.33)" oninput="uKelly()"></div>
        <div><label class="lbl">BET ODDS</label><input type="number" id="ko" value="-110" style="text-align:center;font-size:17px;font-weight:700;color:#FF6B35;border-color:rgba(255,107,53,.33)" oninput="uKelly()"></div>
      </div>
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#4A5568;margin-bottom:6px">
          <span>KELLY FRACTION</span><span id="kfl" style="color:#FF6B35">${(S.kf*100).toFixed(0)}% ${S.kf===.5?"· HALF-KELLY ✓":S.kf===1?"· FULL-KELLY ⚠":""}</span>
        </div>
        <input type="range" min="0.1" max="1" step="0.05" value="${S.kf}" oninput="S.kf=parseFloat(this.value);document.getElementById('kfl').textContent=(S.kf*100).toFixed(0)+'% '+(S.kf===.5?'· HALF-KELLY ✓':S.kf===1?'· FULL-KELLY ⚠':'');uKelly()">
      </div>
      <div class="g3" id="kr"></div>
      <div id="kw2"></div>
    </div>
    <div style="background:rgba(78,205,196,.03);border:1px solid rgba(78,205,196,.1);border-radius:12px;padding:16px">
      <div style="font-size:9px;color:#4ECDC4;letter-spacing:2px;margin-bottom:12px">PROJECTED GROWTH · 55% WR · 3 BETS/DAY</div>
      <div class="g3" id="kp"></div>
    </div>`;
    uKelly();
  }
 
  else if(t==="clv"){
    pg.innerHTML=`
    <div style="background:rgba(69,183,209,.03);border:1px solid rgba(69,183,209,.14);border-radius:12px;padding:18px;margin-bottom:12px">
      <div style="font-size:9px;color:#45B7D1;letter-spacing:2px;margin-bottom:14px">▷ CLV — PINNACLE BENCHMARK</div>
      <div style="padding:8px 12px;background:rgba(78,205,196,.05);border-radius:6px;font-size:11px;color:#4ECDC4;margin-bottom:12px">Beat Pinnacle's close = verified edge.</div>
      <div class="g2" style="margin-bottom:12px">
        <div><label class="lbl">YOUR BET ODDS</label><input type="number" id="cb" value="-110" style="text-align:center;font-size:17px;font-weight:700;color:#45B7D1;border-color:rgba(69,183,209,.33)" oninput="uCLV()"></div>
        <div><label class="lbl">PINNACLE CLOSING ODDS</label><input type="number" id="cc" value="-115" style="text-align:center;font-size:17px;font-weight:700;color:#45B7D1;border-color:rgba(69,183,209,.33)" oninput="uCLV()"></div>
      </div>
      <div class="g3" id="clvr" style="margin-bottom:12px"></div>
      <div id="clvv"></div>
    </div>
    ${card(`<div style="font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:0;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.05)">ALL BETS · AVG CLV <span style="color:${ac>=0?"#4ECDC4":"#FF4757"}">${ac>=0?"+":""}${ac.toFixed(2)}%</span></div>
    ${S.bets.map(b=>{const c2=cv(b.betOdds,b.closingOdds);return`<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.03)"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><div><span style="font-size:9px;color:${SC[b.sport]||"#FF6B35"};margin-right:8px">${b.sport}</span><span style="font-size:11px;color:#9CA3AF">${b.pick}</span></div><span style="font-size:11px;font-weight:700;color:${c2>=0?"#4ECDC4":"#FF4757"}">${c2>=0?"+":""}${c2.toFixed(2)}%</span></div><div style="height:2px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden"><div style="height:100%;width:${Math.min(Math.abs(c2)*15,100)}%;background:${c2>=0?"#4ECDC4":"#FF4757"};border-radius:2px"></div></div></div>`;}).join("")}`)}`;
    uCLV();
  }
 
  else if(t==="odds"){
    pg.innerHTML=`
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
      ${["AFL","NBA","NFL"].map(sp=>`<button class="btn" style="background:${S.oSport===sp?SC[sp]+"18":"transparent"};border:1px solid ${S.oSport===sp?SC[sp]:"rgba(255,255,255,.07)"};color:${S.oSport===sp?SC[sp]:"#374151"}" onclick="S.oSport='${sp}';S.odds=[];S.selGame=null;renderPage();fetchOdds('${sp}','odds')">${sp}</button>`).join("")}
      <button class="btn tc" style="margin-left:auto" onclick="S.odds=[];S.selGame=null;fetchOdds(S.oSport,'odds')">↻ REFRESH</button>
    </div>
    <div style="padding:8px 12px;background:rgba(78,205,196,.04);border:1px solid rgba(78,205,196,.1);border-radius:8px;font-size:10px;color:#4A5568;margin-bottom:10px;display:flex;justify-content:space-between">
      <span>Live odds via Railway proxy · Enter AU book odds manually below</span>
      <span>${S.remReq?S.remReq+"/500":""}</span>
    </div>
    ${S.oddsErr?`<div style="padding:12px;background:rgba(255,71,87,.06);border:1px solid rgba(255,71,87,.18);border-radius:8px;color:#FF4757;font-size:12px;margin-bottom:12px">⚠ ${S.oddsErr}</div>`:""}
    ${S.odds.length===0?`<div style="text-align:center;padding:50px;color:#374151">No games loaded. Select a sport and hit REFRESH.</div>`:""}
    ${S.odds.map(g=>{
      const gt=new Date(g.commence_time);
      const isOpen=S.selGame===g.id;
      const gm=S.mOdds[g.id]||{};
      const allPrices=g.bookmakers?.flatMap(bm=>bm.markets?.find(m=>m.key==="h2h")?.outcomes||[])||[];
      const bestP=allPrices.length?Math.max(...allPrices.map(o=>o.price)):null;
      return`<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px;border-color:${isOpen?"rgba(255,107,53,.28)":"rgba(255,255,255,.07)"}">
        <div onclick="S.selGame=S.selGame==='${g.id}'?null:'${g.id}';renderPage()" style="padding:12px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:9px;color:#374151;margin-bottom:3px">${gt.toLocaleDateString("en-AU")} ${gt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
            <div style="font-size:13px;font-weight:700">${g.away_team}</div>
            <div style="font-size:10px;color:#4A5568">@ ${g.home_team}</div>
          </div>
          <div style="text-align:right">
            ${bestP?`<div style="font-size:11px;color:#4ECDC4">Best ${fo(bestP)}</div>`:""}
            <div style="font-size:11px;color:#FF6B35;margin-top:3px">${isOpen?"▲":"▼"}</div>
          </div>
        </div>
        ${isOpen?`<div style="border-top:1px solid rgba(255,255,255,.05);padding:12px 14px">
          <div style="margin-bottom:14px;background:rgba(255,107,53,.03);border-radius:8px;padding:10px">
            <div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:8px">MANUAL AU BOOK ODDS (AWAY H2H)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px">
              ${MB.map(bk=>{
                const bi=BOOKS.find(b=>b.k===bk);
                const val=gm[bk]||"";
                const pP=g.bookmakers?.find(b=>b.key==="pinnacle")?.markets?.find(m=>m.key==="h2h")?.outcomes[0]?.price;
                const edge=val&&pP&&parseInt(val)>pP;
                return`<div style="background:${edge?"rgba(78,205,196,.07)":"rgba(255,255,255,.02)"};border:1px solid ${edge?"rgba(78,205,196,.25)":"rgba(255,255,255,.05)"};border-radius:6px;padding:7px">
                  <div style="font-size:9px;color:#374151;margin-bottom:3px">${bi?.l}</div>
                  <input type="number" placeholder="-110" value="${val}" style="width:100%;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,.08);color:${edge?"#4ECDC4":"#E8EAF0"};font-size:12px;font-weight:700;font-family:inherit;outline:none;padding:2px 0;box-sizing:border-box" onchange="S.mOdds['${g.id}']=S.mOdds['${g.id}']||{};S.mOdds['${g.id}']['${bk}']=this.value;renderPage()">
                  ${edge?'<div style="font-size:8px;color:#4ECDC4;margin-top:2px">BEATS PIN ✓</div>':""}
                </div>`;
              }).join("")}
            </div>
          </div>
          ${["h2h","spreads","totals"].map(market=>{
            if(!g.bookmakers?.some(b=>b.markets?.find(m=>m.key===market))) return "";
            const mc2={h2h:"#FF6B35",spreads:"#45B7D1",totals:"#F0A500"};
            const ml={h2h:"MONEYLINE",spreads:"SPREAD",totals:"TOTAL"};
            const sides=market==="totals"?["Over","Under"]:[g.away_team,g.home_team];
            return`<div style="margin-bottom:12px">
              <div style="font-size:9px;color:${mc2[market]};letter-spacing:2px;margin-bottom:8px">${ml[market]}</div>
              <div class="g2">
                ${sides.map((side,ti)=>{
                  const bms=(g.bookmakers||[]).map(bm=>{
                    const m=bm.markets?.find(x=>x.key===market);
                    const o=market==="totals"?m?.outcomes?.find(x=>x.name===side):m?.outcomes[ti];
                    return o?{key:bm.key,price:o.price,point:o.point}:null;
                  }).filter(Boolean);
                  const bp=bms.length?Math.max(...bms.map(b=>b.price)):-999;
                  return`<div style="background:rgba(255,255,255,.02);border-radius:8px;padding:10px">
                    <div style="font-size:10px;color:#6B7280;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${side}</div>
                    <div style="display:flex;gap:5px;flex-wrap:wrap">
                      ${bms.map(bm=>`<div style="background:${bm.price===bp?mc2[market]+"18":"rgba(255,255,255,.03)"};border:1px solid ${bm.price===bp?mc2[market]+"44":"rgba(255,255,255,.05)"};border-radius:6px;padding:5px 7px;text-align:center">
                        <div style="font-size:8px;color:#374151">${bm.key.replace("_au","").slice(0,4).toUpperCase()}</div>
                        ${market!=="h2h"?`<div style="font-size:9px;color:#4A5568">${bm.point>0?"+":""}${bm.point}</div>`:""}
                        <div style="font-size:12px;font-weight:700;color:${bm.price===bp?mc2[market]:"#E8EAF0"}">${fo(bm.price)}</div>
                      </div>`).join("")}
                    </div>
                  </div>`;
                }).join("")}
              </div>
            </div>`;
          }).join("")}
          <div style="font-size:10px;color:#1F2937;margin-top:8px">💡 Green = best line. Enter AU book odds above to compare against Pinnacle.</div>
        </div>`:""}
      </div>`;
    }).join("")}`;
  }
 
  else if(t==="books"){
    const bStats=BOOKS.map(bk=>{
      const bb=s.filter(b=>b.bk===bk.k);
      const bw=bb.filter(b=>b.result==="W").length;
      const bwr=bb.length?bw/bb.length*100:0;
      return{...bk,n:bb.length,wr:bwr,pr:bb.reduce((a,b)=>b.result==="W"?a+b.stake*(a2d(b.betOdds)-1):b.result==="L"?a-b.stake:a,0),cv2:bb.reduce((a,b)=>a+cv(b.betOdds,b.closingOdds),0)/(bb.length||1),li:S.limits.find(l=>l.bk===bk.k),risk:bb.length>=30&&bwr>=58};
    });
    pg.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:9px;color:#374151;letter-spacing:2px">BOOKMAKER HEALTH</div>
      <button class="btn r" onclick="document.getElementById('alf').classList.toggle('hidden')">+ LOG LIMIT</button>
    </div>
    <div id="alf" class="hidden" style="background:rgba(255,71,87,.03);border:1px solid rgba(255,71,87,.15);border-radius:12px;padding:14px;margin-bottom:12px">
      <div class="g2">
        <div><label class="lbl">BOOKMAKER</label><select id="nl-bk">${BOOKS.map(b=>`<option value="${b.k}">${b.l}</option>`).join("")}</select></div>
        <div><label class="lbl">DATE</label><input type="date" id="nl-date"></div>
        <div><label class="lbl">ORIGINAL MAX $</label><input type="number" id="nl-orig" placeholder="100"></div>
        <div><label class="lbl">CURRENT MAX $</label><input type="number" id="nl-curr" placeholder="20"></div>
        <div style="grid-column:1/-1"><label class="lbl">NOTES</label><input type="text" id="nl-notes" placeholder="Reason..."></div>
      </div>
      <button class="btn r" style="width:100%;margin-top:10px;padding:10px;font-size:11px;font-weight:700" onclick="addLimit()">LOG LIMIT</button>
    </div>
    ${bStats.map(bk=>card(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="display:flex;gap:7px;align-items:center;margin-bottom:4px">
            <span style="font-size:13px;font-weight:700;color:${bk.c}">${bk.l}</span>
            <span style="font-size:9px;color:${bk.c};background:${bk.c}14;padding:2px 6px;border-radius:4px">${bk.t}</span>
            ${bk.li?'<span style="font-size:9px;color:#FF4757;background:rgba(255,71,87,.1);padding:2px 6px;border-radius:4px">LIMITED</span>':""}
            ${bk.risk&&!bk.li?'<span style="font-size:9px;color:#F0A500;background:rgba(240,165,0,.1);padding:2px 6px;border-radius:4px">⚠ AT RISK</span>':""}
          </div>
          ${bk.li?`<div style="font-size:11px;color:#FF4757">$${bk.li.orig} → $${bk.li.curr} max · ${bk.li.date}</div>`:""}
          ${bk.risk&&!bk.li?`<div style="font-size:11px;color:#F0A500">${bk.wr.toFixed(1)}% WR — reduce stake now</div>`:""}
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:900;color:${bk.pr>=0?"#4ECDC4":"#FF4757"}">${bk.pr>=0?"+":""}$${bk.pr.toFixed(0)}</div>
          <div style="font-size:9px;color:#374151">${bk.n} bets</div>
        </div>
      </div>
      <div class="g3">
        ${[{l:"WIN RATE",v:bk.wr.toFixed(1)+"%",c:bk.wr>=52.4?"#4ECDC4":"#FF4757"},{l:"AVG CLV",v:(bk.cv2>=0?"+":"")+bk.cv2.toFixed(2)+"%",c:bk.cv2>=0?"#4ECDC4":"#FF4757"},{l:"STATUS",v:bk.li?"$"+bk.li.curr+" MAX":"ACTIVE",c:bk.li?"#FF4757":"#4ECDC4"}].map(x=>`<div style="background:rgba(255,255,255,.02);border-radius:8px;padding:8px;text-align:center"><div style="font-size:9px;color:#374151;margin-bottom:3px">${x.l}</div><div style="font-size:12px;font-weight:700;color:${x.c}">${x.v}</div></div>`).join("")}
      </div>
    `,`style="border-color:${bk.li?"rgba(255,71,87,.22)":bk.risk?"rgba(240,165,0,.22)":"rgba(255,255,255,.07)"};margin-bottom:10px"`)).join("")}`;
  }
 
  else if(t==="settings"){
    pg.innerHTML=`
    <div style="font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:14px">⚙ SETTINGS</div>
    ${card(`<label class="lbl">BANKROLL $</label><input type="number" value="${S.bankroll}" onchange="S.bankroll=parseFloat(this.value)||0;document.getElementById('bk').value=S.bankroll;uBar()">`,"style='margin-bottom:10px'")}
    ${card(`<div style="display:flex;justify-content:space-between;font-size:10px;color:#4A5568;margin-bottom:8px"><span>KELLY FRACTION</span><span style="color:#FF6B35">${(S.kf*100).toFixed(0)}% ${S.kf===.5?"· HALF-KELLY ✓":""}</span></div>
    <input type="range" min="0.1" max="1" step="0.05" value="${S.kf}" oninput="S.kf=parseFloat(this.value)">`,"style='margin-bottom:10px'")}
    <div class="card" style="background:rgba(255,107,53,.03);border:1px solid rgba(255,107,53,.12)">
      <div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:12px">DATA SOURCES</div>
      ${[
        {name:"The Odds API",status:"Live odds · NFL, NBA, AFL · via this server",color:"#4ECDC4"},
        {name:"Anthropic Claude",status:"AI analysis · Game insights · Multi EV",color:"#FF6B35"},
        {name:"Railway Server",status:"This app — no restrictions, always on",color:"#4ECDC4"},
      ].map(src=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <div><div style="font-size:12px;font-weight:600">${src.name}</div><div style="font-size:10px;color:#4A5568">${src.status}</div></div>
        <div style="font-size:9px;color:${src.color};background:${src.color}14;padding:2px 8px;border-radius:4px">ACTIVE</div>
      </div>`).join("")}
    </div>`;
  }
 
  uBar();
}
 
function uKelly(){
  const wp=parseFloat(document.getElementById("kw")?.value||55);
  const bo=parseInt(document.getElementById("ko")?.value||-110);
  const edge=(wp-a2i(bo)).toFixed(2);
  const hk=kl(wp,bo)*S.kf;
  const bs=(S.bankroll*hk/100).toFixed(2);
  const r=document.getElementById("kr");
  if(r) r.innerHTML=[{l:"EDGE",v:(parseFloat(edge)>0?"+":"")+edge+"%",c:parseFloat(edge)>0?"#4ECDC4":"#FF4757"},{l:"KELLY %",v:hk.toFixed(2)+"%",c:"#FF6B35"},{l:"BET SIZE",v:"$"+bs,c:"#F0A500"}].map(x=>miniCard(x.l,x.v,x.c)).join("");
  const w=document.getElementById("kw2");
  if(w) w.innerHTML=parseFloat(edge)<=0?'<div style="margin-top:10px;padding:9px 12px;background:rgba(255,71,87,.06);border:1px solid rgba(255,71,87,.18);border-radius:8px;font-size:11px;color:#FF4757">⚠ NEGATIVE EDGE — DO NOT BET.</div>':"";
  const pr=document.getElementById("kp");
  if(pr) pr.innerHTML=[{p:"1 MONTH",n:90},{p:"3 MONTHS",n:270},{p:"1 YEAR",n:1095}].map(x=>{
    const w2=Math.round(x.n*.55),st=parseFloat(bs);
    const prf=w2*st*(a2d(bo)-1)-(x.n-w2)*st;
    return miniCard(x.p,"$"+(S.bankroll+prf).toFixed(0)+(prf>=0?" <span style='font-size:10px'>(+"+"$"+prf.toFixed(0)+")</span>":""),prf>=0?"#4ECDC4":"#FF4757");
  }).join("");
}
 
function uCLV(){
  const b=parseInt(document.getElementById("cb")?.value||-110);
  const c2=parseInt(document.getElementById("cc")?.value||-115);
  const cvv=cv(b,c2);
  const r=document.getElementById("clvr");
  if(r) r.innerHTML=[{l:"YOUR IMPLIED",v:a2i(b).toFixed(1)+"%",c:"#45B7D1"},{l:"PINNACLE CLOSE",v:a2i(c2).toFixed(1)+"%",c:"#45B7D1"},{l:"CLV",v:(cvv>=0?"+":"")+cvv.toFixed(2)+"%",c:cvv>=0?"#4ECDC4":"#FF4757"}].map(x=>miniCard(x.l,x.v,x.c)).join("");
  const v=document.getElementById("clvv");
  if(v) v.innerHTML=`<div style="padding:10px 12px;background:${cvv>=0?"rgba(78,205,196,.05)":"rgba(255,71,87,.05)"};border:1px solid ${cvv>=0?"rgba(78,205,196,.16)":"rgba(255,71,87,.16)"};border-radius:8px;font-size:11px;color:${cvv>=0?"#4ECDC4":"#FF4757"}">${cvv>=0?"✓ POSITIVE CLV — Verified edge.":"✗ NEGATIVE CLV — Market moved against you."}</div>`;
}
 
// Init
renderTabs();
renderPage();
</script>
</body>
</html>`);
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("EDGE//STACK v2.0 running on port " + PORT));
