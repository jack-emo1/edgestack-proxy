const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
 
app.use(cors());
app.use(express.json());
 
const ODDS_API_KEY = process.env.ODDS_API_KEY || "ca6d6693352b4b3e3ea11856734a9870";
const ODDS_BASE = "https://api.the-odds-api.com/v4";
 
// ── Odds proxy endpoints ──
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
 
app.get("/api/sports", async (req, res) => {
  try {
    const response = await fetch(`${ODDS_BASE}/sports/?apiKey=${ODDS_API_KEY}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
app.get("/api/health", (req, res) => {
  res.json({ status: "EDGE//STACK Online", version: "2.0" });
});
 
// ── Serve the platform HTML ──
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>EDGE//STACK</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #080B14; color: #E8EAF0; font-family: 'Courier New', monospace; }
    input[type=range] { accent-color: #FF6B35; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: #080B14; }
    ::-webkit-scrollbar-thumb { background: rgba(255,107,53,0.3); border-radius: 2px; }
    select option { background: #0D1119; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    const { useState, useEffect, useCallback } = React;
 
    // ── Config — all API calls go through this same server ──
    const PROXY = "";  // empty = same origin
    const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
 
    const SPORT_KEYS = { NBA: "basketball_nba", NFL: "americanfootball_nfl", AFL: "aussierules_afl" };
    const SPORT_COLORS = { NBA: "#FF6B35", NFL: "#4ECDC4", AFL: "#00A86B" };
    const AU_BOOKS = [
      { key: "pinnacle", label: "Pinnacle", tier: "SHARP", color: "#4ECDC4" },
      { key: "sportsbet", label: "Sportsbet", tier: "SOFT", color: "#FF6B35" },
      { key: "ladbrokes", label: "Ladbrokes", tier: "SOFT", color: "#FF6B35" },
      { key: "neds", label: "Neds", tier: "SOFT", color: "#FF6B35" },
      { key: "tab", label: "TAB", tier: "SEMI", color: "#F0A500" },
      { key: "betnation", label: "BetNation", tier: "SOFT", color: "#FF6B35" },
    ];
    const MANUAL_BOOKS = ["sportsbet", "neds", "tab", "betnation"];
 
    function americanToDecimal(o) { if (!o) return 1; return o > 0 ? o/100+1 : 100/Math.abs(o)+1; }
    function americanToImplied(o) { return (1/americanToDecimal(o))*100; }
    function formatOdds(o) { if (!o) return "—"; return o > 0 ? "+"+o : ""+o; }
    function calcKelly(p, odds) { const b=americanToDecimal(odds)-1,q=1-p/100; return Math.max(0,((b*p/100-q)/b)*100); }
    function calcCLV(bet, close) { if(!bet||!close) return 0; return americanToImplied(close)-americanToImplied(bet); }
    function bookLabel(key) { return AU_BOOKS.find(b=>b.key===key)?.label||key; }
 
    const INITIAL_BETS = [
      {id:1,date:"2024-01-15",sport:"NBA",game:"Lakers vs Celtics",pick:"Lakers -3.5",betOdds:-110,closingOdds:-115,result:"W",stake:27.50,bookmaker:"sportsbet"},
      {id:2,date:"2024-01-16",sport:"NFL",game:"Chiefs vs Ravens",pick:"Over 47.5",betOdds:-108,closingOdds:-112,result:"L",stake:27.50,bookmaker:"ladbrokes"},
      {id:3,date:"2024-01-17",sport:"NBA",game:"Warriors vs Suns",pick:"Warriors +2",betOdds:-105,closingOdds:-110,result:"W",stake:28.00,bookmaker:"pinnacle"},
      {id:4,date:"2024-01-18",sport:"AFL",game:"Collingwood vs Richmond",pick:"Collingwood -9.5",betOdds:-110,closingOdds:-118,result:"W",stake:27.00,bookmaker:"sportsbet"},
      {id:5,date:"2024-01-20",sport:"NBA",game:"Bucks vs Heat",pick:"Giannis O 32.5",betOdds:-112,closingOdds:-120,result:"W",stake:27.25,bookmaker:"neds"},
      {id:6,date:"2024-01-21",sport:"NFL",game:"49ers vs Packers",pick:"49ers -6.5",betOdds:-110,closingOdds:-108,result:"W",stake:27.50,bookmaker:"tab"},
      {id:7,date:"2024-01-22",sport:"AFL",game:"Geelong vs Hawthorn",pick:"Under 164.5",betOdds:-106,closingOdds:-110,result:"L",stake:27.75,bookmaker:"betnation"},
    ];
    const INITIAL_LIMITS = [
      {id:1,book:"sportsbet",originalMax:100,currentMax:20,date:"2024-01-10",notes:"Limited after 3 week winning run"},
    ];
 
    const s = {
      card: {background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"16px"},
      inp: (a="#FF6B35")=>({width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid "+a+"33",borderRadius:8,color:a,padding:"10px 12px",fontSize:17,fontWeight:700,fontFamily:"inherit",boxSizing:"border-box",textAlign:"center",outline:"none"}),
      lbl: {fontSize:9,color:"#374151",letterSpacing:2,marginBottom:5,display:"block"},
      fi: {width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,color:"#E8EAF0",padding:"8px 10px",fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none"},
      sel: {width:"100%",background:"#0D1119",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,color:"#E8EAF0",padding:"8px 10px",fontSize:12,fontFamily:"inherit",boxSizing:"border-box"},
      btn: (a="#FF6B35")=>({background:a+"18",border:"1px solid "+a+"44",color:a,padding:"7px 14px",borderRadius:6,cursor:"pointer",fontSize:10,letterSpacing:2,fontFamily:"inherit",whiteSpace:"nowrap"}),
    };
 
    function Sparkline({data,color="#4ECDC4",height=40}){
      if(data.length<2) return null;
      const vals=data.map(d=>d.value),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
      const w=200,h=height;
      const pts=vals.map((v,i)=>(i/(vals.length-1))*w+","+(h-((v-min)/range)*h)).join(" ");
      return React.createElement("svg",{viewBox:"0 0 "+w+" "+h,style:{width:"100%",height},preserveAspectRatio:"none"},
        React.createElement("polyline",{points:pts,fill:"none",stroke:color,strokeWidth:"1.5",strokeLinejoin:"round"}),
        React.createElement("polyline",{points:"0,"+h+" "+pts+" "+w+","+h,fill:color+"12",stroke:"none"})
      );
    }
 
    function App(){
      const [cfg,setCfg]=useState({bankroll:1000,kellyFraction:0.5,oddsApiKey:"ca6d6693352b4b3e3ea11856734a9870"});
      const [tab,setTab]=useState("dashboard");
      const [bets,setBets]=useState(INITIAL_BETS);
      const [limits,setLimits]=useState(INITIAL_LIMITS);
      const [showAddBet,setShowAddBet]=useState(false);
      const [showAddLimit,setShowAddLimit]=useState(false);
      const [newBet,setNewBet]=useState({date:"",sport:"AFL",game:"",pick:"",betOdds:-110,closingOdds:-110,result:"P",bookmaker:"sportsbet"});
      const [newLimit,setNewLimit]=useState({book:"sportsbet",originalMax:"",currentMax:"",date:"",notes:""});
      const [winProb,setWinProb]=useState(55);
      const [betOddsCalc,setBetOddsCalc]=useState(-110);
      const [closingOddsInput,setClosingOddsInput]=useState(-115);
      const [selectedSport,setSelectedSport]=useState("AFL");
      const [liveOdds,setLiveOdds]=useState([]);
      const [oddsLoading,setOddsLoading]=useState(false);
      const [oddsError,setOddsError]=useState(null);
      const [requestsRemaining,setRequestsRemaining]=useState(null);
      const [selectedGame,setSelectedGame]=useState(null);
      const [manualOdds,setManualOdds]=useState({});
      const [analysisSport,setAnalysisSport]=useState("AFL");
      const [analysisOdds,setAnalysisOdds]=useState([]);
      const [analysisOddsLoading,setAnalysisOddsLoading]=useState(false);
      const [analysisLoading,setAnalysisLoading]=useState({});
      const [analysisResults,setAnalysisResults]=useState({});
      const [multiLegs,setMultiLegs]=useState([{id:1,pick:"",odds:-110,winProb:55},{id:2,pick:"",odds:-110,winProb:55}]);
 
      const settled=bets.filter(b=>b.result!=="P");
      const wins=settled.filter(b=>b.result==="W").length;
      const winRate=settled.length?(wins/settled.length*100):0;
      const totalStaked=settled.reduce((a,b)=>a+b.stake,0);
      const totalReturned=settled.reduce((a,b)=>b.result==="W"?a+b.stake*americanToDecimal(b.betOdds):a,0);
      const totalProfit=totalReturned-totalStaked;
      const avgCLV=settled.reduce((a,b)=>a+calcCLV(b.betOdds,b.closingOdds),0)/(settled.length||1);
      const clvRate=settled.length?(settled.filter(b=>calcCLV(b.betOdds,b.closingOdds)>0).length/settled.length*100):0;
      const kellyPct=calcKelly(winProb,betOddsCalc);
      const halfKelly=kellyPct*cfg.kellyFraction;
      const betSize=(cfg.bankroll*halfKelly/100).toFixed(2);
      const edge=(winProb-americanToImplied(betOddsCalc)).toFixed(2);
 
      const bankrollHistory=(()=>{
        let bal=cfg.bankroll;
        const h=[{date:"Start",value:bal}];
        [...settled].sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(bet=>{
          if(bet.result==="W") bal+=bet.stake*(americanToDecimal(bet.betOdds)-1);
          else if(bet.result==="L") bal-=bet.stake;
          h.push({date:bet.date,value:parseFloat(bal.toFixed(2))});
        });
        return h;
      })();
 
      const bookStats=AU_BOOKS.map(book=>{
        const bb=settled.filter(b=>b.bookmaker===book.key);
        const bw=bb.filter(b=>b.result==="W").length;
        const bwr=bb.length?(bw/bb.length*100):0;
        const bp=bb.reduce((a,b)=>b.result==="W"?a+b.stake*(americanToDecimal(b.betOdds)-1):b.result==="L"?a-b.stake:a,0);
        const bc=bb.reduce((a,b)=>a+calcCLV(b.betOdds,b.closingOdds),0)/(bb.length||1);
        return{...book,bets:bb.length,winRate:bwr,profit:bp,clv:bc,limitInfo:limits.find(l=>l.book===book.key),atRisk:bb.length>=30&&bwr>=58};
      });
 
      const sportStats=Object.keys(SPORT_KEYS).map(sport=>{
        const sb=settled.filter(b=>b.sport===sport);
        const sw=sb.filter(b=>b.result==="W").length;
        const profit=sb.reduce((a,b)=>b.result==="W"?a+b.stake*(americanToDecimal(b.betOdds)-1):b.result==="L"?a-b.stake:a,0);
        return{sport,bets:sb.length,winRate:sb.length?sw/sb.length*100:0,profit,clv:sb.reduce((a,b)=>a+calcCLV(b.betOdds,b.closingOdds),0)/(sb.length||1)};
      });
 
      const multiCalc=(()=>{
        const legs=multiLegs.filter(l=>l.odds&&l.winProb>0);
        if(legs.length<2) return null;
        const combinedDec=legs.reduce((a,l)=>a*americanToDecimal(l.odds),1);
        const combinedProb=legs.reduce((a,l)=>a*(l.winProb/100),1)*100;
        const ev=(combinedProb/100)*(combinedDec-1)-(1-combinedProb/100);
        const combinedAmerican=combinedDec>=2?Math.round((combinedDec-1)*100):Math.round(-100/(combinedDec-1));
        return{combinedDec,combinedProb,ev,allPositive:legs.every(l=>(l.winProb-americanToImplied(l.odds))>0),combinedAmerican,legs:legs.length};
      })();
 
      const fetchLiveOdds=useCallback(async(sport,setterFn,setLoadingFn,setErrorFn)=>{
        setLoadingFn(true);setErrorFn&&setErrorFn(null);
        try{
          const res=await fetch(PROXY+"/api/odds/"+SPORT_KEYS[sport]+"?regions=us,au,uk&markets=h2h,spreads,totals&oddsFormat=american");
          if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||"Error "+res.status);}
          const data=await res.json();
          setRequestsRemaining(res.headers.get("x-requests-remaining"));
          setterFn(data);
        }catch(e){setErrorFn&&setErrorFn(e.message);}
        finally{setLoadingFn(false);}
      },[]);
 
      useEffect(()=>{
        if(tab==="odds"){setSelectedGame(null);setManualOdds({});fetchLiveOdds(selectedSport,setLiveOdds,setOddsLoading,setOddsError);}
      },[tab,selectedSport]);
 
      useEffect(()=>{
        if(tab==="analysis") fetchLiveOdds(analysisSport,setAnalysisOdds,setAnalysisOddsLoading,null);
      },[tab,analysisSport]);
 
      async function runAnalysis(game,sport){
        const gid=game.id;
        setAnalysisLoading(p=>({...p,[gid]:true}));
        setAnalysisResults(p=>({...p,[gid]:null}));
        try{
          const pinH2H=game.bookmakers?.find(b=>b.key==="pinnacle")?.markets?.find(m=>m.key==="h2h");
          const pinSpread=game.bookmakers?.find(b=>b.key==="pinnacle")?.markets?.find(m=>m.key==="spreads");
          const pinTotal=game.bookmakers?.find(b=>b.key==="pinnacle")?.markets?.find(m=>m.key==="totals");
          const oddsCtx=[
            pinH2H?"H2H: "+pinH2H.outcomes?.map(o=>o.name+" "+formatOdds(o.price)).join(" / "):null,
            pinSpread?"Spread: "+pinSpread.outcomes?.map(o=>o.name+" "+(o.point>0?"+":"")+o.point+" "+formatOdds(o.price)).join(" / "):null,
            pinTotal?"Total: "+pinTotal.outcomes?.map(o=>o.name+" "+o.point+" "+formatOdds(o.price)).join(" / "):null,
          ].filter(Boolean).join("\n");
 
          const prompt="You are a sharp professional sports betting analyst specialising in Australian betting markets.\n\nGAME: "+game.away_team+" @ "+game.home_team+"\nDATE: "+new Date(game.commence_time).toLocaleDateString("en-AU")+"\nSPORT: "+sport+"\n\nPINNACLE ODDS:\n"+(oddsCtx||"No Pinnacle odds available — use other books if shown")+"\n\nUsing your knowledge of these teams, provide:\n\nEDGE ASSESSMENT: [Value on either side? Which market?]\n\nKEY FACTORS:\n- [Factor 1]\n- [Factor 2]\n- [Factor 3]\n\nRECOMMENDED BET: [Pick, market, which AU book, confidence Low/Medium/High]\n\nCLV EXPECTATION: [Will line move in your favour?]\n\nMULTI POTENTIAL: [Good multi leg or too risky?]\n\nVERDICT: [One sentence. No hedging.]";
 
          const res=await fetch(ANTHROPIC_BASE+"/messages",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})
          });
          if(!res.ok) throw new Error("Analysis error "+res.status);
          const data=await res.json();
          setAnalysisResults(p=>({...p,[gid]:data.content?.find(c=>c.type==="text")?.text||"No analysis returned"}));
        }catch(e){
          setAnalysisResults(p=>({...p,[gid]:"Error: "+e.message}));
        }finally{
          setAnalysisLoading(p=>({...p,[gid]:false}));
        }
      }
 
      function addBet(){
        setBets(p=>[...p,{...newBet,id:Date.now(),stake:parseFloat(betSize)}]);
        setShowAddBet(false);
        setNewBet({date:"",sport:"AFL",game:"",pick:"",betOdds:-110,closingOdds:-110,result:"P",bookmaker:"sportsbet"});
      }
 
      function addLimit(){
        setLimits(p=>[...p,{...newLimit,id:Date.now(),originalMax:parseFloat(newLimit.originalMax),currentMax:parseFloat(newLimit.currentMax)}]);
        setShowAddLimit(false);
        setNewLimit({book:"sportsbet",originalMax:"",currentMax:"",date:"",notes:""});
      }
 
      function logFromLive(game,pick,bookKey,odds){
        setNewBet({date:new Date().toISOString().split("T")[0],sport:selectedSport,game:game.away_team+" @ "+game.home_team,pick,betOdds:odds,closingOdds:odds,result:"P",bookmaker:bookKey.replace("_au","")});
        setShowAddBet(true);setTab("tracker");
      }
 
      function getBest(game,market,ti){
        let best=null,bestBook=null;
        for(const bm of game.bookmakers||[]){
          const o=bm.markets?.find(x=>x.key===market)?.outcomes[ti];
          if(!o) continue;
          if(best===null||o.price>best){best=o.price;bestBook=bm.key;}
        }
        return{odds:best,book:bestBook};
      }
 
      const tabs=[
        {id:"dashboard",label:"Dashboard",icon:"⬡"},
        {id:"tracker",label:"Tracker",icon:"◈"},
        {id:"analysis",label:"AI Analysis",icon:"◎"},
        {id:"multi",label:"Multi EV",icon:"◇"},
        {id:"kelly",label:"Kelly",icon:"△"},
        {id:"clv",label:"CLV",icon:"▷"},
        {id:"odds",label:"Live Odds",icon:"◉"},
        {id:"books",label:"Books",icon:"▣"},
        {id:"breakdown",label:"Breakdown",icon:"◐"},
        {id:"settings",label:"Settings",icon:"⚙"},
      ];
 
      const T=(tag,props,...children)=>React.createElement(tag,props,...children);
      const D=(props,...children)=>T("div",props,...children);
      const B=(props,...children)=>T("button",props,...children);
 
      return D({style:{minHeight:"100vh",background:"#080B14",color:"#E8EAF0",fontFamily:"'Courier New',monospace"}},
        D({style:{position:"fixed",inset:0,backgroundImage:"linear-gradient(rgba(255,107,53,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,107,53,0.02) 1px,transparent 1px)",backgroundSize:"40px 40px",pointerEvents:"none",zIndex:0}}),
        D({style:{position:"relative",zIndex:1,maxWidth:880,margin:"0 auto",padding:"0 14px 100px"}},
 
          // Header
          D({style:{padding:"20px 0 12px",borderBottom:"1px solid rgba(255,107,53,0.12)",display:"flex",alignItems:"center",gap:12}},
            D({style:{width:32,height:32,background:"linear-gradient(135deg,#FF6B35,#F0A500)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:15,color:"#080B14",flexShrink:0}},"E"),
            D({},
              D({style:{fontSize:14,fontWeight:700,letterSpacing:3,color:"#FF6B35"}},"EDGE//STACK"),
              D({style:{fontSize:9,color:"#1F2937",letterSpacing:2}},"AU · NFL · NBA · AFL · AI POWERED")
            ),
            D({style:{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}},
              T("span",{style:{fontSize:9,color:"#4ECDC4"}},"BK $"),
              T("input",{value:cfg.bankroll,onChange:e=>setCfg(p=>({...p,bankroll:parseFloat(e.target.value)||0})),style:{width:75,background:"rgba(78,205,196,0.07)",border:"1px solid rgba(78,205,196,0.2)",borderRadius:6,color:"#4ECDC4",padding:"4px 8px",fontSize:13,fontFamily:"inherit",fontWeight:700,textAlign:"right",outline:"none"}})
            )
          ),
 
          // Tabs
          D({style:{display:"flex",gap:2,padding:"8px 0 12px",overflowX:"auto"}},
            ...tabs.map(t=>B({key:t.id,onClick:()=>setTab(t.id),style:{background:tab===t.id?"rgba(255,107,53,0.1)":"transparent",border:tab===t.id?"1px solid rgba(255,107,53,0.4)":"1px solid transparent",color:tab===t.id?"#FF6B35":"#374151",padding:"6px 10px",borderRadius:6,cursor:"pointer",fontSize:9,letterSpacing:2,fontFamily:"inherit",whiteSpace:"nowrap"}},t.icon+" "+t.label))
          ),
 
          // DASHBOARD
          tab==="dashboard"&&D({},
            ...bookStats.filter(b=>b.atRisk&&!b.limitInfo).map(b=>D({key:b.key,style:{padding:"9px 12px",background:"rgba(255,71,87,0.07)",border:"1px solid rgba(255,71,87,0.2)",borderRadius:8,fontSize:11,color:"#FF4757",marginBottom:9,display:"flex",justifyContent:"space-between"}},
              T("span",{},"⚠ "+b.label+" — "+b.winRate.toFixed(1)+"% WR over "+b.bets+" bets. Limiting risk HIGH."),
              T("span",{style:{fontWeight:700}},"ACT NOW")
            )),
            D({style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}},
              ...[
                {label:"WIN RATE",value:winRate.toFixed(1)+"%",sub:wins+"W · "+(settled.length-wins)+"L",color:winRate>=52.4?"#4ECDC4":"#FF4757"},
                {label:"PROFIT",value:(totalProfit>=0?"+":"")+"$"+totalProfit.toFixed(0),sub:(totalProfit/(cfg.bankroll*0.0275)).toFixed(1)+" units",color:totalProfit>=0?"#FF6B35":"#FF4757"},
                {label:"AVG CLV",value:(avgCLV>=0?"+":"")+avgCLV.toFixed(2)+"%",sub:clvRate.toFixed(0)+"% positive",color:avgCLV>=0?"#4ECDC4":"#FF4757"},
                {label:"BETS",value:settled.length,sub:bets.filter(b=>b.result==="P").length+" pending",color:"#F0A500"},
              ].map((m,i)=>D({key:i,style:{...s.card,position:"relative",overflow:"hidden"}},
                D({style:{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,"+m.color+",transparent)"}}),
                D({style:{fontSize:9,color:"#374151",letterSpacing:2,marginBottom:4}},m.label),
                D({style:{fontSize:22,fontWeight:900,color:m.color,lineHeight:1}},m.value),
                D({style:{fontSize:10,color:"#4A5568",marginTop:4}},m.sub)
              ))
            ),
            D({style:{...s.card,marginBottom:12}},
              D({style:{fontSize:9,color:"#374151",letterSpacing:2,marginBottom:8}},"◈ BANKROLL GROWTH"),
              D({style:{display:"flex",justifyContent:"space-between",fontSize:10,color:"#4A5568",marginBottom:6}},
                T("span",{},"Start: $"+bankrollHistory[0]?.value.toFixed(0)),
                T("span",{style:{color:totalProfit>=0?"#4ECDC4":"#FF4757"}},"Now: $"+bankrollHistory[bankrollHistory.length-1]?.value.toFixed(0))
              ),
              React.createElement(Sparkline,{data:bankrollHistory,color:totalProfit>=0?"#4ECDC4":"#FF4757",height:48})
            ),
            D({style:{background:"rgba(255,107,53,0.03)",border:"1px solid rgba(255,107,53,0.12)",borderRadius:12,padding:14,marginBottom:12}},
              D({style:{fontSize:9,color:"#FF6B35",letterSpacing:2,marginBottom:10}},"◎ EDGE HEALTH"),
              ...[
                {label:"Win Rate vs Breakeven 52.4%",val:winRate,threshold:52.4,max:65},
                {label:"CLV Positive Rate",val:clvRate,threshold:50,max:100},
                {label:"Sample Confidence (1000+ target)",val:Math.min(settled.length/10,100),threshold:50,max:100},
              ].map((bar,i)=>D({key:i,style:{marginBottom:9}},
                D({style:{display:"flex",justifyContent:"space-between",fontSize:10,color:"#4A5568",marginBottom:4}},
                  T("span",{},bar.label),
                  T("span",{style:{color:bar.val>=bar.threshold?"#4ECDC4":"#FF4757"}},bar.val.toFixed(1)+"%")
                ),
                D({style:{height:3,background:"rgba(255,255,255,0.04)",borderRadius:3,overflow:"hidden"}},
                  D({style:{height:"100%",width:Math.min(bar.val/bar.max*100,100)+"%",background:bar.val>=bar.threshold?"#4ECDC4":"#FF4757",borderRadius:3}})
                )
              ))
            ),
            D({style:{...s.card,padding:0,overflow:"hidden"}},
              D({style:{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)",fontSize:9,color:"#374151",letterSpacing:2}},"RECENT BETS"),
              ...bets.slice(-6).reverse().map(bet=>{
                const clv=calcCLV(bet.betOdds,bet.closingOdds);
                return D({key:bet.id,style:{display:"flex",alignItems:"center",padding:"9px 14px",borderBottom:"1px solid rgba(255,255,255,0.03)",gap:10}},
                  D({style:{width:5,height:5,borderRadius:"50%",background:bet.result==="W"?"#4ECDC4":bet.result==="L"?"#FF4757":"#F0A500",flexShrink:0}}),
                  T("span",{style:{fontSize:9,color:SPORT_COLORS[bet.sport],width:34,flexShrink:0}},bet.sport),
                  T("span",{style:{flex:1,fontSize:11,color:"#9CA3AF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},bet.pick),
                  T("span",{style:{fontSize:9,color:"#374151",flexShrink:0}},bookLabel(bet.bookmaker)),
                  T("span",{style:{fontSize:10,color:clv>0?"#4ECDC4":"#FF4757",flexShrink:0}},(clv>0?"+":"")+clv.toFixed(1)+"%"),
                  T("span",{style:{fontSize:11,fontWeight:700,color:bet.result==="W"?"#4ECDC4":bet.result==="L"?"#FF4757":"#F0A500",width:16,textAlign:"center"}},bet.result)
                );
              })
            )
          ),
 
          // TRACKER
          tab==="tracker"&&D({},
            D({style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
              D({style:{fontSize:9,color:"#374151",letterSpacing:2}},bets.length+" BETS LOGGED"),
              B({onClick:()=>setShowAddBet(v=>!v),style:s.btn()},"+ LOG BET")
            ),
            showAddBet&&D({style:{background:"rgba(255,107,53,0.03)",border:"1px solid rgba(255,107,53,0.15)",borderRadius:12,padding:14,marginBottom:12}},
              D({style:{fontSize:9,color:"#FF6B35",letterSpacing:2,marginBottom:10}},"NEW BET"),
              D({style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
                ...[{label:"DATE",key:"date",type:"date"},{label:"GAME",key:"game",type:"text",placeholder:"Team A vs B"},{label:"PICK",key:"pick",type:"text",placeholder:"Team A -3.5"},{label:"BET ODDS",key:"betOdds",type:"number"},{label:"CLOSING ODDS",key:"closingOdds",type:"number"}].map(f=>D({key:f.key},
                  T("label",{style:s.lbl},f.label),
                  T("input",{type:f.type,placeholder:f.placeholder,value:newBet[f.key],onChange:e=>setNewBet(p=>({...p,[f.key]:f.type==="number"?parseInt(e.target.value)||0:e.target.value})),style:s.fi})
                )),
                ...[{label:"SPORT",key:"sport",opts:Object.keys(SPORT_KEYS)},{label:"BOOKMAKER",key:"bookmaker",opts:AU_BOOKS.map(b=>b.key),labels:AU_BOOKS.map(b=>b.label)},{label:"RESULT",key:"result",opts:["P","W","L"],labels:["Pending","Win","Loss"]}].map(f=>D({key:f.key},
                  T("label",{style:s.lbl},f.label),
                  T("select",{value:newBet[f.key],onChange:e=>setNewBet(p=>({...p,[f.key]:e.target.value})),style:s.sel},
                    ...f.opts.map((o,i)=>T("option",{key:o,value:o},f.labels?f.labels[i]:o))
                  )
                ))
              ),
              D({style:{marginTop:10,padding:"8px 12px",background:"rgba(78,205,196,0.06)",borderRadius:8,fontSize:11,color:"#4ECDC4"}},
                "Kelly stake: ",T("strong",{},"$"+betSize)," ("+halfKelly.toFixed(2)+"% of bankroll)"
              ),
              B({onClick:addBet,style:{marginTop:10,width:"100%",background:"linear-gradient(135deg,#FF6B35,#F0A500)",border:"none",color:"#080B14",padding:"10px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700,letterSpacing:2,fontFamily:"inherit"}},"LOG BET")
            ),
            ...bets.slice().reverse().map(bet=>{
              const clv=calcCLV(bet.betOdds,bet.closingOdds);
              const pnl=bet.result==="W"?bet.stake*(americanToDecimal(bet.betOdds)-1):bet.result==="L"?-bet.stake:0;
              const li=limits.find(l=>l.book===bet.bookmaker);
              return D({key:bet.id,style:{...s.card,marginBottom:8,border:"1px solid "+(bet.result==="W"?"rgba(78,205,196,0.15)":bet.result==="L"?"rgba(255,71,87,0.15)":"rgba(240,165,0,0.15)")}},
                D({style:{display:"flex",justifyContent:"space-between",marginBottom:6}},
                  D({},
                    D({style:{display:"flex",gap:6,marginBottom:3,flexWrap:"wrap"}},
                      T("span",{style:{fontSize:9,color:SPORT_COLORS[bet.sport]}},bet.sport),
                      T("span",{style:{fontSize:9,color:"#374151"}},bet.date),
                      T("span",{style:{fontSize:9,color:AU_BOOKS.find(b=>b.key===bet.bookmaker)?.color||"#6B7280"}},bookLabel(bet.bookmaker)),
                      li&&T("span",{style:{fontSize:9,color:"#FF4757",background:"rgba(255,71,87,0.1)",padding:"1px 5px",borderRadius:3}},"LIMITED $"+li.currentMax)
                    ),
                    D({style:{fontSize:13,fontWeight:600}},bet.pick),
                    D({style:{fontSize:10,color:"#4A5568"}},bet.game)
                  ),
                  D({style:{textAlign:"right",flexShrink:0}},
                    D({style:{fontSize:15,fontWeight:900,color:bet.result==="W"?"#4ECDC4":bet.result==="L"?"#FF4757":"#F0A500"}},bet.result==="P"?"PENDING":(pnl>=0?"+":"")+"$"+pnl.toFixed(2)),
                    D({style:{fontSize:9,color:"#374151"}},"stake $"+bet.stake.toFixed(2))
                  )
                ),
                D({style:{display:"flex",gap:12,fontSize:10}},
                  T("span",{style:{color:"#4A5568"}},"Bet ",T("span",{style:{color:"#E8EAF0"}},formatOdds(bet.betOdds))),
                  T("span",{style:{color:"#4A5568"}},"Close ",T("span",{style:{color:"#E8EAF0"}},formatOdds(bet.closingOdds))),
                  T("span",{style:{color:clv>0?"#4ECDC4":"#FF4757"}},"CLV "+(clv>0?"+":"")+clv.toFixed(2)+"%")
                )
              );
            })
          ),
 
          // AI ANALYSIS
          tab==="analysis"&&D({},
            D({style:{padding:"10px 14px",background:"rgba(78,205,196,0.05)",border:"1px solid rgba(78,205,196,0.14)",borderRadius:10,fontSize:11,color:"#4ECDC4",marginBottom:14,lineHeight:1.6}},
              "◎ Claude analyses each game using live odds + deep knowledge of team form, stats, injuries and matchup history."
            ),
            D({style:{display:"flex",gap:6,marginBottom:12,alignItems:"center"}},
              ...Object.keys(SPORT_KEYS).map(sp=>B({key:sp,onClick:()=>setAnalysisSport(sp),style:{background:analysisSport===sp?SPORT_COLORS[sp]+"18":"transparent",border:"1px solid "+(analysisSport===sp?SPORT_COLORS[sp]:"rgba(255,255,255,0.07)"),color:analysisSport===sp?SPORT_COLORS[sp]:"#374151",padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:10,fontFamily:"inherit"}},sp)),
              B({onClick:()=>fetchLiveOdds(analysisSport,setAnalysisOdds,setAnalysisOddsLoading,null),style:{marginLeft:"auto",...s.btn("#4ECDC4")}},analysisOddsLoading?"···":"↻ REFRESH")
            ),
            analysisOddsLoading&&D({style:{textAlign:"center",padding:40,color:"#374151"}},"Loading "+analysisSport+" games···"),
            !analysisOddsLoading&&analysisOdds.length===0&&D({style:{textAlign:"center",padding:40,color:"#374151"}},"No upcoming "+analysisSport+" games. Try another sport or refresh."),
            ...analysisOdds.map(game=>{
              const gameTime=new Date(game.commence_time);
              const result=analysisResults[game.id];
              const loading=analysisLoading[game.id];
              const pinH2H=game.bookmakers?.find(b=>b.key==="pinnacle")?.markets?.find(m=>m.key==="h2h");
              return D({key:game.id,style:{...s.card,marginBottom:12}},
                D({style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}},
                  D({},
                    D({style:{fontSize:9,color:"#374151",marginBottom:3}},gameTime.toLocaleDateString("en-AU")+" "+gameTime.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})),
                    D({style:{fontSize:14,fontWeight:700}},game.away_team),
                    D({style:{fontSize:11,color:"#4A5568"}},"@ "+game.home_team),
                    pinH2H&&D({style:{display:"flex",gap:10,marginTop:6,fontSize:10,flexWrap:"wrap"}},
                      ...pinH2H.outcomes?.map((o,i)=>T("span",{key:i,style:{color:"#4ECDC4"}},o.name+": ",T("strong",{},formatOdds(o.price)))),
                      T("span",{style:{color:"#374151"}},"· Pinnacle")
                    )
                  ),
                  B({onClick:()=>runAnalysis(game,analysisSport),disabled:loading,style:{...s.btn("#FF6B35"),flexShrink:0,opacity:loading?0.7:1}},loading?"ANALYSING···":"◎ ANALYSE")
                ),
                result&&D({style:{background:"rgba(255,107,53,0.04)",border:"1px solid rgba(255,107,53,0.18)",borderRadius:10,padding:14}},
                  D({style:{fontSize:9,color:"#FF6B35",letterSpacing:2,marginBottom:10}},"AI ANALYSIS · CLAUDE"),
                  D({style:{fontSize:12,color:"#D1D5DB",lineHeight:1.9,whiteSpace:"pre-wrap"}},result),
                  B({onClick:()=>{setShowAddBet(true);setTab("tracker");},style:{...s.btn(),marginTop:12}},"+ LOG THIS BET")
                )
              );
            })
          ),
 
          // MULTI EV
          tab==="multi"&&D({},
            D({style:{padding:"10px 14px",background:"rgba(78,205,196,0.04)",border:"1px solid rgba(78,205,196,0.12)",borderRadius:10,fontSize:11,color:"#4ECDC4",marginBottom:14,lineHeight:1.6}},
              "◇ Enter each leg's odds and estimated win probability. Calculator shows if combining has positive expected value."
            ),
            ...multiLegs.map((leg,i)=>D({key:leg.id,style:{...s.card,marginBottom:10}},
              D({style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
                D({style:{fontSize:10,color:"#FF6B35",letterSpacing:2}},"LEG "+(i+1)),
                multiLegs.length>2&&B({onClick:()=>setMultiLegs(p=>p.filter(l=>l.id!==leg.id)),style:{...s.btn("#FF4757"),padding:"3px 8px",fontSize:9}},"✕")
              ),
              D({style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
                D({style:{gridColumn:"1/-1"}},
                  T("label",{style:s.lbl},"PICK"),
                  T("input",{type:"text",placeholder:"e.g. Collingwood -9.5",value:leg.pick,onChange:e=>setMultiLegs(p=>p.map(l=>l.id===leg.id?{...l,pick:e.target.value}:l)),style:s.fi})
                ),
                D({},T("label",{style:s.lbl},"ODDS"),T("input",{type:"number",value:leg.odds,onChange:e=>setMultiLegs(p=>p.map(l=>l.id===leg.id?{...l,odds:parseInt(e.target.value)||0}:l)),style:{...s.fi,textAlign:"center",fontSize:14,fontWeight:700}})),
                D({},T("label",{style:s.lbl},"WIN PROB %"),T("input",{type:"number",value:leg.winProb,onChange:e=>setMultiLegs(p=>p.map(l=>l.id===leg.id?{...l,winProb:parseFloat(e.target.value)||0}:l)),style:{...s.fi,textAlign:"center",fontSize:14,fontWeight:700}})),
                D({},
                  T("label",{style:s.lbl},"LEG EDGE"),
                  D({style:{padding:"8px",background:"rgba(255,255,255,0.03)",borderRadius:6,textAlign:"center",fontSize:13,fontWeight:700,color:(leg.winProb-americanToImplied(leg.odds))>0?"#4ECDC4":"#FF4757"}},
                    ((leg.winProb-americanToImplied(leg.odds))>0?"+":"")+((leg.winProb-americanToImplied(leg.odds)).toFixed(2)+"%")
                  )
                )
              )
            )),
            B({onClick:()=>setMultiLegs(p=>[...p,{id:Date.now(),pick:"",odds:-110,winProb:55}]),style:{...s.btn("#4ECDC4"),width:"100%",marginBottom:14,padding:"10px",textAlign:"center"}},"+ ADD LEG"),
            multiCalc&&D({style:{background:multiCalc.ev>0?"rgba(78,205,196,0.05)":"rgba(255,71,87,0.05)",border:"1px solid "+(multiCalc.ev>0?"rgba(78,205,196,0.2)":"rgba(255,71,87,0.2)"),borderRadius:12,padding:16}},
              D({style:{fontSize:9,color:multiCalc.ev>0?"#4ECDC4":"#FF4757",letterSpacing:2,marginBottom:14}},multiCalc.ev>0?"✓ POSITIVE EV MULTI":"✗ NEGATIVE EV MULTI"),
              D({style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}},
                ...[
                  {label:"COMBINED ODDS",value:formatOdds(multiCalc.combinedAmerican),color:"#FF6B35"},
                  {label:"WIN PROBABILITY",value:multiCalc.combinedProb.toFixed(2)+"%",color:"#F0A500"},
                  {label:"EXPECTED VALUE",value:(multiCalc.ev>=0?"+":"")+multiCalc.ev.toFixed(3),color:multiCalc.ev>0?"#4ECDC4":"#FF4757"},
                ].map((x,i)=>D({key:i,style:{...s.card,textAlign:"center"}},
                  D({style:{fontSize:9,color:"#374151",marginBottom:5}},x.label),
                  D({style:{fontSize:15,fontWeight:900,color:x.color}},x.value)
                ))
              ),
              D({style:{fontSize:11,lineHeight:1.7}},
                multiCalc.ev>0
                  ?T("span",{style:{color:"#4ECDC4"}},"✓ Positive EV "+multiCalc.legs+"-leg multi. Max stake: $"+(cfg.bankroll*0.01).toFixed(2)+" (1% bankroll).")
                  :T("span",{style:{color:"#FF4757"}},"✗ "+(!multiCalc.allPositive?"One or more legs have no individual edge — fix those first.":"Combined vig destroys edge across legs.")+" Do not place this multi.")
              )
            )
          ),
 
          // KELLY
          tab==="kelly"&&D({},
            D({style:{background:"rgba(255,107,53,0.03)",border:"1px solid rgba(255,107,53,0.12)",borderRadius:12,padding:18,marginBottom:12}},
              D({style:{fontSize:9,color:"#FF6B35",letterSpacing:2,marginBottom:14}},"△ KELLY CRITERION"),
              D({style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}},
                D({},T("label",{style:s.lbl},"WIN PROBABILITY %"),T("input",{type:"number",value:winProb,onChange:e=>setWinProb(parseFloat(e.target.value)),style:s.inp()})),
                D({},T("label",{style:s.lbl},"BET ODDS"),T("input",{type:"number",value:betOddsCalc,onChange:e=>setBetOddsCalc(parseInt(e.target.value)||0),style:s.inp()}))
              ),
              D({style:{marginBottom:14}},
                D({style:{display:"flex",justifyContent:"space-between",fontSize:10,color:"#4A5568",marginBottom:6}},
                  T("span",{},"KELLY FRACTION"),
                  T("span",{style:{color:"#FF6B35"}},(cfg.kellyFraction*100).toFixed(0)+"% "+(cfg.kellyFraction===0.5?"· HALF-KELLY ✓":cfg.kellyFraction===1?"· FULL-KELLY ⚠":""))
                ),
                T("input",{type:"range",min:"0.1",max:"1",step:"0.05",value:cfg.kellyFraction,onChange:e=>setCfg(p=>({...p,kellyFraction:parseFloat(e.target.value)})),style:{width:"100%"}})
              ),
              D({style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
                ...[
                  {label:"EDGE",value:(parseFloat(edge)>0?"+":"")+edge+"%",color:parseFloat(edge)>0?"#4ECDC4":"#FF4757"},
                  {label:"KELLY %",value:halfKelly.toFixed(2)+"%",color:"#FF6B35"},
                  {label:"BET SIZE",value:"$"+betSize,color:"#F0A500"},
                ].map((x,i)=>D({key:i,style:{...s.card,textAlign:"center"}},
                  D({style:{fontSize:9,color:"#374151",marginBottom:5}},x.label),
                  D({style:{fontSize:16,fontWeight:900,color:x.color}},x.value)
                ))
              ),
              parseFloat(edge)<=0&&D({style:{marginTop:10,padding:"9px 12px",background:"rgba(255,71,87,0.06)",border:"1px solid rgba(255,71,87,0.18)",borderRadius:8,fontSize:11,color:"#FF4757"}},"⚠ NEGATIVE EDGE — DO NOT BET.")
            ),
            D({style:{background:"rgba(78,205,196,0.03)",border:"1px solid rgba(78,205,196,0.1)",borderRadius:12,padding:16}},
              D({style:{fontSize:9,color:"#4ECDC4",letterSpacing:2,marginBottom:12}},"PROJECTED GROWTH · 55% WR · 3 BETS/DAY"),
              D({style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
                ...[{p:"1 MONTH",n:90},{p:"3 MONTHS",n:270},{p:"1 YEAR",n:1095}].map((x,i)=>{
                  const w=Math.round(x.n*0.55),stake=parseFloat(betSize);
                  const profit=w*stake*(americanToDecimal(betOddsCalc)-1)-(x.n-w)*stake;
                  return D({key:i,style:{...s.card,textAlign:"center"}},
                    D({style:{fontSize:9,color:"#374151",marginBottom:4}},x.p),
                    D({style:{fontSize:14,fontWeight:900,color:profit>=0?"#4ECDC4":"#FF4757"}},"$"+(cfg.bankroll+profit).toFixed(0)),
                    D({style:{fontSize:10,color:profit>=0?"#4ECDC4":"#FF4757",marginTop:2}},(profit>=0?"+":"")+"$"+profit.toFixed(0))
                  );
                })
              )
            )
          ),
 
          // CLV
          tab==="clv"&&D({},
            D({style:{background:"rgba(69,183,209,0.03)",border:"1px solid rgba(69,183,209,0.14)",borderRadius:12,padding:18,marginBottom:12}},
              D({style:{fontSize:9,color:"#45B7D1",letterSpacing:2,marginBottom:14}},"▷ CLV — PINNACLE BENCHMARK"),
              D({style:{padding:"8px 12px",background:"rgba(78,205,196,0.05)",borderRadius:6,fontSize:11,color:"#4ECDC4",marginBottom:12}},"Beat Pinnacle's close = verified edge."),
              D({style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:12}},
                D({},T("label",{style:s.lbl},"YOUR BET ODDS"),T("input",{type:"number",value:betOddsCalc,onChange:e=>setBetOddsCalc(parseInt(e.target.value)||0),style:s.inp("#45B7D1")})),
                D({},T("label",{style:s.lbl},"PINNACLE CLOSING ODDS"),T("input",{type:"number",value:closingOddsInput,onChange:e=>setClosingOddsInput(parseInt(e.target.value)||0),style:s.inp("#45B7D1")}))
              ),
              D({style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}},
                ...[
                  {label:"YOUR IMPLIED",value:americanToImplied(betOddsCalc).toFixed(1)+"%",color:"#45B7D1"},
                  {label:"PINNACLE CLOSE",value:americanToImplied(parseInt(closingOddsInput)).toFixed(1)+"%",color:"#45B7D1"},
                  {label:"CLV",value:(calcCLV(betOddsCalc,parseInt(closingOddsInput))>=0?"+":"")+calcCLV(betOddsCalc,parseInt(closingOddsInput)).toFixed(2)+"%",color:calcCLV(betOddsCalc,parseInt(closingOddsInput))>=0?"#4ECDC4":"#FF4757"},
                ].map((x,i)=>D({key:i,style:{...s.card,textAlign:"center"}},
                  D({style:{fontSize:9,color:"#374151",marginBottom:5}},x.label),
                  D({style:{fontSize:16,fontWeight:900,color:x.color}},x.value)
                ))
              ),
              D({style:{padding:"10px 12px",background:calcCLV(betOddsCalc,parseInt(closingOddsInput))>=0?"rgba(78,205,196,0.05)":"rgba(255,71,87,0.05)",border:"1px solid "+(calcCLV(betOddsCalc,parseInt(closingOddsInput))>=0?"rgba(78,205,196,0.16)":"rgba(255,71,87,0.16)"),borderRadius:8,fontSize:11}},
                calcCLV(betOddsCalc,parseInt(closingOddsInput))>=0
                  ?T("span",{style:{color:"#4ECDC4"}},"✓ POSITIVE CLV — Verified edge.")
                  :T("span",{style:{color:"#FF4757"}},"✗ NEGATIVE CLV — Market moved against you.")
              )
            ),
            D({style:{...s.card,padding:0,overflow:"hidden"}},
              D({style:{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)",fontSize:9,color:"#374151",letterSpacing:2}},
                "ALL BETS · AVG CLV ",T("span",{style:{color:avgCLV>=0?"#4ECDC4":"#FF4757"}},(avgCLV>=0?"+":"")+avgCLV.toFixed(2)+"%")
              ),
              ...bets.map(bet=>{
                const clv=calcCLV(bet.betOdds,bet.closingOdds);
                return D({key:bet.id,style:{padding:"9px 14px",borderBottom:"1px solid rgba(255,255,255,0.03)"}},
                  D({style:{display:"flex",justifyContent:"space-between",marginBottom:4}},
                    D({},T("span",{style:{fontSize:9,color:SPORT_COLORS[bet.sport],marginRight:8}},bet.sport),T("span",{style:{fontSize:11,color:"#9CA3AF"}},bet.pick)),
                    T("span",{style:{fontSize:11,fontWeight:700,color:clv>=0?"#4ECDC4":"#FF4757"}},(clv>=0?"+":"")+clv.toFixed(2)+"%")
                  ),
                  D({style:{height:2,background:"rgba(255,255,255,0.04)",borderRadius:2,overflow:"hidden"}},
                    D({style:{height:"100%",width:Math.min(Math.abs(clv)*15,100)+"%",background:clv>=0?"#4ECDC4":"#FF4757",borderRadius:2}})
                  )
                );
              })
            )
          ),
 
          // LIVE ODDS
          tab==="odds"&&D({},
            D({style:{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}},
              ...Object.keys(SPORT_KEYS).map(sp=>B({key:sp,onClick:()=>setSelectedSport(sp),style:{background:selectedSport===sp?SPORT_COLORS[sp]+"18":"transparent",border:"1px solid "+(selectedSport===sp?SPORT_COLORS[sp]:"rgba(255,255,255,0.07)"),color:selectedSport===sp?SPORT_COLORS[sp]:"#374151",padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:10,fontFamily:"inherit"}},sp)),
              B({onClick:()=>fetchLiveOdds(selectedSport,setLiveOdds,setOddsLoading,setOddsError),disabled:oddsLoading,style:{marginLeft:"auto",...s.btn("#4ECDC4")}},oddsLoading?"···":"↻ REFRESH")
            ),
            D({style:{padding:"8px 12px",background:"rgba(78,205,196,0.04)",border:"1px solid rgba(78,205,196,0.1)",borderRadius:8,fontSize:10,color:"#4A5568",marginBottom:10,display:"flex",justifyContent:"space-between"}},
              T("span",{},"Live odds via Railway proxy · Enter AU book odds manually"),
              requestsRemaining&&T("span",{},"Requests: ",T("span",{style:{color:parseInt(requestsRemaining)<50?"#FF4757":"#4ECDC4"}},requestsRemaining+"/500"))
            ),
            oddsError&&D({style:{padding:12,background:"rgba(255,71,87,0.06)",border:"1px solid rgba(255,71,87,0.18)",borderRadius:8,color:"#FF4757",fontSize:12,marginBottom:12}},"⚠ "+oddsError),
            oddsLoading&&D({style:{textAlign:"center",padding:50,color:"#374151"}},"Fetching "+selectedSport+" odds···"),
            !oddsLoading&&!oddsError&&liveOdds.length===0&&D({style:{textAlign:"center",padding:50,color:"#374151"}},"No upcoming "+selectedSport+" games."),
            ...liveOdds.map(game=>{
              const gameTime=new Date(game.commence_time);
              const isOpen=selectedGame===game.id;
              const gameManual=manualOdds[game.id]||{};
              const bestML=getBest(game,"h2h",0);
              return D({key:game.id,style:{...s.card,marginBottom:10,padding:0,overflow:"hidden",border:"1px solid "+(isOpen?"rgba(255,107,53,0.28)":"rgba(255,255,255,0.07)")}},
                D({onClick:()=>setSelectedGame(isOpen?null:game.id),style:{padding:"12px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}},
                  D({},
                    D({style:{fontSize:9,color:"#374151",marginBottom:3}},gameTime.toLocaleDateString("en-AU")+" "+gameTime.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})),
                    D({style:{fontSize:13,fontWeight:700}},game.away_team),
                    D({style:{fontSize:10,color:"#4A5568"}},"@ "+game.home_team)
                  ),
                  D({style:{textAlign:"right"}},
                    bestML.odds&&D({style:{fontSize:11,color:"#4ECDC4"}},"Best "+formatOdds(bestML.odds)),
                    D({style:{fontSize:11,color:"#FF6B35",marginTop:3}},isOpen?"▲":"▼")
                  )
                ),
                isOpen&&D({style:{borderTop:"1px solid rgba(255,255,255,0.05)",padding:"12px 14px"}},
                  D({style:{marginBottom:14,background:"rgba(255,107,53,0.03)",borderRadius:8,padding:10}},
                    D({style:{fontSize:9,color:"#FF6B35",letterSpacing:2,marginBottom:8}},"MANUAL AU BOOK ODDS"),
                    D({style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}},
                      ...MANUAL_BOOKS.map(bk=>{
                        const binfo=AU_BOOKS.find(b=>b.key===bk);
                        const val=gameManual[bk]||"";
                        const pinOdds=game.bookmakers?.find(b=>b.key==="pinnacle")?.markets?.find(m=>m.key==="h2h")?.outcomes[0]?.price;
                        const hasEdge=val&&pinOdds&&parseInt(val)>pinOdds;
                        return D({key:bk,style:{background:hasEdge?"rgba(78,205,196,0.07)":"rgba(255,255,255,0.02)",border:"1px solid "+(hasEdge?"rgba(78,205,196,0.25)":"rgba(255,255,255,0.05)"),borderRadius:6,padding:7}},
                          D({style:{fontSize:9,color:"#374151",marginBottom:3}},binfo?.label),
                          T("input",{type:"number",placeholder:"−110",value:val,onChange:e=>setManualOdds(p=>({...p,[game.id]:{...p[game.id],[bk]:e.target.value}})),style:{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,0.08)",color:hasEdge?"#4ECDC4":"#E8EAF0",fontSize:12,fontWeight:700,fontFamily:"inherit",outline:"none",padding:"2px 0",boxSizing:"border-box"}}),
                          hasEdge&&D({style:{fontSize:8,color:"#4ECDC4",marginTop:2}},"BEATS PIN ✓")
                        );
                      })
                    )
                  ),
                  ...["h2h","spreads","totals"].map(market=>{
                    if(!game.bookmakers?.some(b=>b.markets?.find(m=>m.key===market))) return null;
                    const mc={h2h:"#FF6B35",spreads:"#45B7D1",totals:"#F0A500"};
                    const ml={h2h:"MONEYLINE",spreads:"SPREAD",totals:"TOTAL"};
                    const sides=market==="totals"?["Over","Under"]:[game.away_team,game.home_team];
                    return D({key:market,style:{marginBottom:12}},
                      D({style:{fontSize:9,color:mc[market],letterSpacing:2,marginBottom:8}},ml[market]),
                      D({style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
                        ...sides.map((side,ti)=>{
                          const best=getBest(game,market,ti);
                          return D({key:ti,style:{background:"rgba(255,255,255,0.02)",borderRadius:8,padding:10}},
                            D({style:{fontSize:10,color:"#6B7280",marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},side),
                            D({style:{display:"flex",gap:5,flexWrap:"wrap"}},
                              ...game.bookmakers?.map(bm=>{
                                const m=bm.markets?.find(x=>x.key===market);
                                const o=market==="totals"?m?.outcomes?.find(x=>x.name===side):m?.outcomes[ti];
                                if(!o) return null;
                                const isBest=bm.key===best.book;
                                const pick=market==="spreads"?o.name+" "+(o.point>0?"+":"")+o.point:market==="totals"?o.name+" "+o.point:side;
                                return B({key:bm.key,onClick:()=>logFromLive(game,pick,bm.key,o.price),style:{background:isBest?mc[market]+"18":"rgba(255,255,255,0.03)",border:"1px solid "+(isBest?mc[market]+"44":"rgba(255,255,255,0.05)"),borderRadius:6,padding:"5px 7px",cursor:"pointer",fontFamily:"inherit",textAlign:"center"}},
                                  D({style:{fontSize:8,color:"#374151"}},bm.key.replace("_au","").slice(0,4).toUpperCase()),
                                  market!=="h2h"&&D({style:{fontSize:9,color:"#4A5568"}},(o.point>0?"+":"")+o.point),
                                  D({style:{fontSize:12,fontWeight:700,color:isBest?mc[market]:"#E8EAF0"}},formatOdds(o.price))
                                );
                              })||[]
                            )
                          );
                        })
                      )
                    );
                  }),
                  D({style:{fontSize:10,color:"#1F2937",marginTop:8}},"💡 Tap odds to pre-fill tracker. Green = beats Pinnacle.")
                )
              );
            })
          ),
 
          // BOOKS
          tab==="books"&&D({},
            D({style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
              D({style:{fontSize:9,color:"#374151",letterSpacing:2}},"BOOKMAKER HEALTH"),
              B({onClick:()=>setShowAddLimit(v=>!v),style:s.btn("#FF4757")},"+ LOG LIMIT")
            ),
            showAddLimit&&D({style:{background:"rgba(255,71,87,0.03)",border:"1px solid rgba(255,71,87,0.15)",borderRadius:12,padding:14,marginBottom:12}},
              D({style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
                D({},T("label",{style:s.lbl},"BOOKMAKER"),T("select",{value:newLimit.book,onChange:e=>setNewLimit(p=>({...p,book:e.target.value})),style:s.sel},...AU_BOOKS.map(b=>T("option",{key:b.key,value:b.key},b.label)))),
                D({},T("label",{style:s.lbl},"DATE"),T("input",{type:"date",value:newLimit.date,onChange:e=>setNewLimit(p=>({...p,date:e.target.value})),style:s.fi})),
                D({},T("label",{style:s.lbl},"ORIGINAL MAX $"),T("input",{type:"number",placeholder:"100",value:newLimit.originalMax,onChange:e=>setNewLimit(p=>({...p,originalMax:e.target.value})),style:s.fi})),
                D({},T("label",{style:s.lbl},"CURRENT MAX $"),T("input",{type:"number",placeholder:"20",value:newLimit.currentMax,onChange:e=>setNewLimit(p=>({...p,currentMax:e.target.value})),style:s.fi})),
                D({style:{gridColumn:"1/-1"}},T("label",{style:s.lbl},"NOTES"),T("input",{type:"text",placeholder:"Reason...",value:newLimit.notes,onChange:e=>setNewLimit(p=>({...p,notes:e.target.value})),style:s.fi}))
              ),
              B({onClick:addLimit,style:{marginTop:10,width:"100%",background:"rgba(255,71,87,0.1)",border:"1px solid rgba(255,71,87,0.28)",color:"#FF4757",padding:"10px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700,letterSpacing:2,fontFamily:"inherit"}},"LOG LIMIT")
            ),
            ...AU_BOOKS.map(book=>{
              const st=bookStats.find(b=>b.key===book.key);
              const li=limits.find(l=>l.book===book.key);
              return D({key:book.key,style:{...s.card,marginBottom:10,border:"1px solid "+(li?"rgba(255,71,87,0.22)":st?.atRisk?"rgba(240,165,0,0.22)":"rgba(255,255,255,0.07)")}},
                D({style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}},
                  D({},
                    D({style:{display:"flex",gap:7,alignItems:"center",marginBottom:4}},
                      T("span",{style:{fontSize:13,fontWeight:700,color:book.color}},book.label),
                      T("span",{style:{fontSize:9,color:book.color,background:book.color+"14",padding:"2px 6px",borderRadius:4}},book.tier),
                      li&&T("span",{style:{fontSize:9,color:"#FF4757",background:"rgba(255,71,87,0.1)",padding:"2px 6px",borderRadius:4}},"LIMITED"),
                      st?.atRisk&&!li&&T("span",{style:{fontSize:9,color:"#F0A500",background:"rgba(240,165,0,0.1)",padding:"2px 6px",borderRadius:4}},"⚠ AT RISK")
                    ),
                    li&&D({style:{fontSize:11,color:"#FF4757"}},"$"+li.originalMax+" → $"+li.currentMax+" max · "+li.date),
                    li?.notes&&D({style:{fontSize:10,color:"#4A5568",marginTop:2}},li.notes),
                    st?.atRisk&&!li&&D({style:{fontSize:11,color:"#F0A500"}},st.winRate.toFixed(1)+"% WR over "+st.bets+" bets — reduce stake now")
                  ),
                  D({style:{textAlign:"right"}},
                    D({style:{fontSize:14,fontWeight:900,color:(st?.profit||0)>=0?"#4ECDC4":"#FF4757"}},(st?.profit||0)>=0?"+":" ","$"+(st?.profit||0).toFixed(0)),
                    D({style:{fontSize:9,color:"#374151"}},(st?.bets||0)+" bets")
                  )
                ),
                D({style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
                  ...[
                    {label:"WIN RATE",value:(st?.winRate||0).toFixed(1)+"%",color:(st?.winRate||0)>=52.4?"#4ECDC4":"#FF4757"},
                    {label:"AVG CLV",value:((st?.clv||0)>=0?"+":"")+((st?.clv||0).toFixed(2))+"%",color:(st?.clv||0)>=0?"#4ECDC4":"#FF4757"},
                    {label:"STATUS",value:li?"$"+li.currentMax+" MAX":"ACTIVE",color:li?"#FF4757":"#4ECDC4"},
                  ].map((x,i)=>D({key:i,style:{background:"rgba(255,255,255,0.02)",borderRadius:8,padding:"8px",textAlign:"center"}},
                    D({style:{fontSize:9,color:"#374151",marginBottom:3}},x.label),
                    D({style:{fontSize:12,fontWeight:700,color:x.color}},x.value)
                  ))
                )
              );
            })
          ),
 
          // BREAKDOWN
          tab==="breakdown"&&D({},
            D({style:{...s.card,marginBottom:12}},
              D({style:{fontSize:9,color:"#374151",letterSpacing:2,marginBottom:12}},"◐ BY SPORT"),
              ...sportStats.map(sp=>D({key:sp.sport,style:{marginBottom:12,paddingBottom:12,borderBottom:"1px solid rgba(255,255,255,0.04)"}},
                D({style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
                  D({style:{display:"flex",gap:8}},
                    T("span",{style:{fontSize:12,fontWeight:700,color:SPORT_COLORS[sp.sport]}},sp.sport),
                    T("span",{style:{fontSize:9,color:"#374151"}},sp.bets+" bets")
                  ),
                  D({style:{display:"flex",gap:12,fontSize:10}},
                    T("span",{style:{color:sp.winRate>=52.4?"#4ECDC4":"#FF4757"}},sp.winRate.toFixed(1)+"% WR"),
                    T("span",{style:{color:sp.clv>=0?"#4ECDC4":"#FF4757"}},(sp.clv>=0?"+":"")+sp.clv.toFixed(2)+"% CLV"),
                    T("span",{style:{color:sp.profit>=0?"#4ECDC4":"#FF4757",fontWeight:700}},(sp.profit>=0?"+":"")+"$"+sp.profit.toFixed(0))
                  )
                ),
                D({style:{height:3,background:"rgba(255,255,255,0.04)",borderRadius:3,overflow:"hidden"}},
                  D({style:{height:"100%",width:(sp.bets?Math.min(sp.winRate/65*100,100):0)+"%",background:sp.winRate>=52.4?SPORT_COLORS[sp.sport]:"#FF4757",borderRadius:3}})
                )
              ))
            ),
            D({style:{...s.card,marginBottom:12}},
              D({style:{fontSize:9,color:"#374151",letterSpacing:2,marginBottom:12}},"▣ BY BOOKMAKER"),
              ...bookStats.filter(b=>b.bets>0).sort((a,b)=>b.profit-a.profit).map(book=>D({key:book.key,style:{marginBottom:11,paddingBottom:11,borderBottom:"1px solid rgba(255,255,255,0.04)"}},
                D({style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}},
                  D({style:{display:"flex",gap:7}},
                    T("span",{style:{fontSize:11,fontWeight:700,color:book.color}},book.label),
                    T("span",{style:{fontSize:9,color:"#374151"}},book.bets+" bets")
                  ),
                  D({style:{display:"flex",gap:10,fontSize:10}},
                    T("span",{style:{color:book.winRate>=52.4?"#4ECDC4":"#FF4757"}},book.winRate.toFixed(1)+"%"),
                    T("span",{style:{color:book.clv>=0?"#4ECDC4":"#FF4757"}},(book.clv>=0?"+":"")+book.clv.toFixed(2)+"%"),
                    T("span",{style:{color:book.profit>=0?"#4ECDC4":"#FF4757",fontWeight:700}},(book.profit>=0?"+":"")+"$"+book.profit.toFixed(0))
                  )
                ),
                D({style:{height:3,background:"rgba(255,255,255,0.04)",borderRadius:3,overflow:"hidden"}},
                  D({style:{height:"100%",width:(book.bets?Math.min(book.winRate/65*100,100):0)+"%",background:book.profit>=0?book.color:"#FF4757",borderRadius:3}})
                )
              ))
            ),
            D({style:{background:"rgba(255,107,53,0.03)",border:"1px solid rgba(255,107,53,0.12)",borderRadius:12,padding:14}},
              D({style:{fontSize:9,color:"#FF6B35",letterSpacing:2,marginBottom:10}},"◈ INSIGHTS"),
              (()=>{
                const bs=sportStats.filter(s=>s.bets>0).sort((a,b)=>b.profit-a.profit)[0];
                const ws=sportStats.filter(s=>s.bets>0).sort((a,b)=>a.profit-b.profit)[0];
                const bb=bookStats.filter(b=>b.bets>0).sort((a,b)=>b.clv-a.clv)[0];
                const wb=bookStats.filter(b=>b.bets>0).sort((a,b)=>a.clv-b.clv)[0];
                return D({style:{display:"flex",flexDirection:"column",gap:7}},
                  bs&&D({style:{fontSize:11,color:"#4ECDC4"}},"✓ Best sport: ",T("strong",{},bs.sport)," — $"+bs.profit.toFixed(0)+" profit. Focus volume here."),
                  ws&&ws.profit<0&&D({style:{fontSize:11,color:"#FF4757"}},"✗ Worst sport: ",T("strong",{},ws.sport)," — $"+ws.profit.toFixed(0)+". Reduce until edge proven."),
                  bb&&D({style:{fontSize:11,color:"#4ECDC4"}},"✓ Best book CLV: ",T("strong",{},bb.label)," — "+bb.clv.toFixed(2)+"%. Prioritise this book."),
                  wb&&wb.clv<0&&D({style:{fontSize:11,color:"#FF4757"}},"✗ Worst book CLV: ",T("strong",{},wb.label)," — "+wb.clv.toFixed(2)+"%. Bad numbers here."),
                  settled.length<100&&D({style:{fontSize:11,color:"#F0A500"}},"⚠ "+settled.length+" bets logged. Need 500+ for reliable insights.")
                );
              })()
            )
          ),
 
          // SETTINGS
          tab==="settings"&&D({},
            D({style:{fontSize:9,color:"#374151",letterSpacing:2,marginBottom:14}},"⚙ SETTINGS"),
            D({style:{...s.card,marginBottom:10}},
              T("label",{style:s.lbl},"BANKROLL $"),
              T("input",{type:"number",value:cfg.bankroll,onChange:e=>setCfg(p=>({...p,bankroll:parseFloat(e.target.value)||0})),style:s.fi})
            ),
            D({style:{...s.card,marginBottom:10}},
              D({style:{display:"flex",justifyContent:"space-between",fontSize:10,color:"#4A5568",marginBottom:8}},
                T("span",{},"KELLY FRACTION"),
                T("span",{style:{color:"#FF6B35"}},(cfg.kellyFraction*100).toFixed(0)+"% "+(cfg.kellyFraction===0.5?"· HALF-KELLY ✓":""))
              ),
              T("input",{type:"range",min:"0.1",max:"1",step:"0.05",value:cfg.kellyFraction,onChange:e=>setCfg(p=>({...p,kellyFraction:parseFloat(e.target.value)})),style:{width:"100%"}})
            ),
            D({style:{...s.card,background:"rgba(255,107,53,0.03)",border:"1px solid rgba(255,107,53,0.12)"}},
              D({style:{fontSize:9,color:"#FF6B35",letterSpacing:2,marginBottom:12}},"DATA SOURCES"),
              ...[
                {name:"The Odds API",status:"Live odds · NFL, NBA, AFL · via Railway proxy",color:"#4ECDC4"},
                {name:"Anthropic Claude",status:"AI analysis · Game insights · Multi EV",color:"#FF6B35"},
                {name:"Railway Proxy",status:"edgestack-proxy-production.up.railway.app",color:"#4ECDC4"},
              ].map((src,i)=>D({key:i,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}},
                D({},
                  D({style:{fontSize:12,fontWeight:600}},src.name),
                  D({style:{fontSize:10,color:"#4A5568"}},src.status)
                ),
                D({style:{fontSize:9,color:src.color,background:src.color+"14",padding:"2px 8px",borderRadius:4}},"ACTIVE")
              ))
            )
          )
 
        ),
 
        // Status bar
        D({style:{position:"fixed",bottom:0,left:0,right:0,background:"rgba(8,11,20,0.96)",borderTop:"1px solid rgba(255,107,53,0.1)",padding:"8px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10}},
          D({style:{fontSize:9,color:"#1F2937",letterSpacing:1}},"EDGE//STACK · AU · AI · HOSTED"),
          D({style:{display:"flex",gap:12}},
            T("span",{style:{fontSize:9,color:winRate>=52.4?"#4ECDC4":"#FF4757"}},"WIN "+winRate.toFixed(1)+"%"),
            T("span",{style:{fontSize:9,color:avgCLV>=0?"#4ECDC4":"#FF4757"}},"CLV "+(avgCLV>=0?"+":"")+avgCLV.toFixed(2)+"%"),
            T("span",{style:{fontSize:9,color:"#FF6B35"}},"BK $"+cfg.bankroll.toFixed(0)),
            T("span",{style:{fontSize:9,color:limits.length>0?"#FF4757":"#374151"}},limits.length+" LIMITED")
          )
        )
      );
    }
 
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(React.createElement(App));
  </script>
</body>
</html>`);
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("EDGE//STACK v2.0 running on port " + PORT));
