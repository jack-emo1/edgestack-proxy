var BOOKS = [
  {k:"pinnacle",l:"Pinnacle",t:"SHARP",c:"#4ECDC4"},
  {k:"sportsbet",l:"Sportsbet",t:"SOFT",c:"#FF6B35"},
  {k:"ladbrokes",l:"Ladbrokes",t:"SOFT",c:"#FF6B35"},
  {k:"neds",l:"Neds",t:"SOFT",c:"#FF6B35"},
  {k:"tab",l:"TAB",t:"SEMI",c:"#F0A500"},
  {k:"betnation",l:"BetNation",t:"SOFT",c:"#FF6B35"}
];
var MB = ["sportsbet","neds","tab","betnation"];
var SC = {NBA:"#FF6B35",NFL:"#4ECDC4",AFL:"#00A86B"};
var SK = {NBA:"basketball_nba",NFL:"americanfootball_nfl",AFL:"aussierules_afl"};
var TABS = [
  {id:"dashboard",icon:"⬡",label:"Dashboard"},
  {id:"tracker",icon:"◈",label:"Tracker"},
  {id:"analysis",icon:"◎",label:"AI Analysis"},
  {id:"multi",icon:"◇",label:"Multi EV"},
  {id:"kelly",icon:"△",label:"Kelly"},
  {id:"clv",icon:"▷",label:"CLV"},
  {id:"odds",icon:"◉",label:"Live Odds"},
  {id:"books",icon:"▣",label:"Books"},
  {id:"settings",icon:"⚙",label:"Settings"}
];

var S = {
  tab: "dashboard", bankroll: 1000, kf: 0.5,
  bets: [
    {id:1,date:"2024-01-15",sport:"NBA",game:"Lakers vs Celtics",pick:"Lakers -3.5",betOdds:-110,closingOdds:-115,result:"W",stake:27.5,bk:"sportsbet"},
    {id:2,date:"2024-01-16",sport:"NFL",game:"Chiefs vs Ravens",pick:"Over 47.5",betOdds:-108,closingOdds:-112,result:"L",stake:27.5,bk:"ladbrokes"},
    {id:3,date:"2024-01-17",sport:"NBA",game:"Warriors vs Suns",pick:"Warriors +2",betOdds:-105,closingOdds:-110,result:"W",stake:28,bk:"pinnacle"},
    {id:4,date:"2024-01-18",sport:"AFL",game:"Collingwood vs Richmond",pick:"Collingwood -9.5",betOdds:-110,closingOdds:-118,result:"W",stake:27,bk:"sportsbet"},
    {id:5,date:"2024-01-20",sport:"NBA",game:"Bucks vs Heat",pick:"Giannis O 32.5",betOdds:-112,closingOdds:-120,result:"W",stake:27.25,bk:"neds"},
    {id:6,date:"2024-01-21",sport:"NFL",game:"49ers vs Packers",pick:"49ers -6.5",betOdds:-110,closingOdds:-108,result:"W",stake:27.5,bk:"tab"},
    {id:7,date:"2024-01-22",sport:"AFL",game:"Geelong vs Hawthorn",pick:"Under 164.5",betOdds:-106,closingOdds:-110,result:"L",stake:27.75,bk:"betnation"}
  ],
  limits: [{id:1,bk:"sportsbet",orig:100,curr:20,date:"2024-01-10",notes:"Limited after winning run"}],
  odds: [], aOdds: [], aRes: {}, selGame: null, mOdds: {},
  legs: [{id:1,pick:"",odds:-110,wp:55},{id:2,pick:"",odds:-110,wp:55}],
  aSport: "AFL", oSport: "AFL", remReq: null, oddsErr: null
};

function a2d(o) { if (!o) return 1; return o > 0 ? o/100+1 : 100/Math.abs(o)+1; }
function a2i(o) { return (1/a2d(o))*100; }
function fo(o) { if (!o) return "—"; return o > 0 ? "+"+o : ""+o; }
function cv(b,c) { if (!b||!c) return 0; return a2i(c)-a2i(b); }
function kl(p,o) { var b=a2d(o)-1, q=1-p/100; return Math.max(0, ((b*p/100-q)/b)*100); }
function bl(k) { var b=BOOKS.find(function(x){return x.k===k;}); return b ? b.l : k; }

function settled() { return S.bets.filter(function(b){return b.result!=="P";}); }
function sts() {
  var s=settled(), w=s.filter(function(b){return b.result==="W";}).length;
  var wr=s.length ? w/s.length*100 : 0;
  var p=s.reduce(function(a,b){return b.result==="W"?a+b.stake*(a2d(b.betOdds)-1):b.result==="L"?a-b.stake:a;},0);
  var ac=s.reduce(function(a,b){return a+cv(b.betOdds,b.closingOdds);},0)/(s.length||1);
  var cr=s.length ? s.filter(function(b){return cv(b.betOdds,b.closingOdds)>0;}).length/s.length*100 : 0;
  return {s:s,w:w,wr:wr,p:p,ac:ac,cr:cr};
}

function uBar() {
  var st=sts(), q=function(id){return document.getElementById(id);};
  if (!q("b-wr")) return;
  q("b-wr").textContent = "WIN "+st.wr.toFixed(1)+"%";
  q("b-wr").style.color = st.wr>=52.4 ? "#4ECDC4" : "#FF4757";
  q("b-clv").textContent = "CLV "+(st.ac>=0?"+":"")+st.ac.toFixed(2)+"%";
  q("b-clv").style.color = st.ac>=0 ? "#4ECDC4" : "#FF4757";
  q("b-bk").textContent = "BK $"+S.bankroll.toFixed(0);
  q("b-lim").textContent = S.limits.length+" LIMITED";
  q("b-lim").style.color = S.limits.length ? "#FF4757" : "#374151";
}

function el(tag, attrs, html) {
  var a = Object.keys(attrs||{}).map(function(k){return k+'="'+attrs[k]+'"';}).join(" ");
  return "<"+tag+(a?" "+a:"")+">"+( html||"" )+"</"+tag+">";
}

function renderTabs() {
  var h = "";
  TABS.forEach(function(t) {
    h += '<button class="tab'+(S.tab===t.id?" on":"")+'" onclick="goTab(\''+t.id+'\')">'+t.icon+" "+t.label+"</button>";
  });
  document.getElementById("tabs").innerHTML = h;
}

function goTab(id) {
  S.tab = id; renderTabs(); renderPage();
  if (id==="analysis" && S.aOdds.length===0) fetchOdds(S.aSport,"aOdds");
  if (id==="odds" && S.odds.length===0) fetchOdds(S.oSport,"odds");
}

function fetchOdds(sport, target) {
  document.getElementById("pg").innerHTML = '<div style="text-align:center;padding:50px;color:#374151">Fetching '+sport+' odds...</div>';
  fetch("/api/odds/"+SK[sport]+"?regions=us,au,uk&markets=h2h,spreads,totals&oddsFormat=american")
    .then(function(r) { S.remReq=r.headers.get("x-requests-remaining"); if(!r.ok) throw new Error("API error "+r.status); return r.json(); })
    .then(function(d) { S[target]=d; S.oddsErr=null; renderPage(); })
    .catch(function(e) { S[target]=[]; S.oddsErr=e.message; renderPage(); });
}

function runAnalysis(gid) {
  var g = S.aOdds.find(function(x){return x.id===gid;});
  if (!g) return;
  S.aRes[gid] = "LOADING"; renderPage();
  var pH=null, pS=null, pT=null;
  (g.bookmakers||[]).forEach(function(bm) {
    if (bm.key==="pinnacle") (bm.markets||[]).forEach(function(m) {
      if (m.key==="h2h") pH=m; if (m.key==="spreads") pS=m; if (m.key==="totals") pT=m;
    });
  });
  var oc = [];
  if (pH) oc.push("H2H: "+pH.outcomes.map(function(o){return o.name+" "+fo(o.price);}).join(" / "));
  if (pS) oc.push("Spread: "+pS.outcomes.map(function(o){return o.name+" "+(o.point>0?"+":"")+o.point+" "+fo(o.price);}).join(" / "));
  if (pT) oc.push("Total: "+pT.outcomes.map(function(o){return o.name+" "+o.point+" "+fo(o.price);}).join(" / "));
  var gt = new Date(g.commence_time);
  var prompt = "You are a sharp professional sports betting analyst specialising in Australian betting markets.\n\nGAME: "+g.away_team+" @ "+g.home_team+"\nDATE: "+gt.toLocaleDateString("en-AU")+"\nSPORT: "+S.aSport+"\n\nPINNACLE ODDS:\n"+(oc.join("\n")||"No Pinnacle odds")+"\n\nUsing your knowledge of these teams provide:\n\nEDGE ASSESSMENT: [Value on either side? Which market?]\n\nKEY FACTORS:\n- [Factor 1]\n- [Factor 2]\n- [Factor 3]\n\nRECOMMENDED BET: [Pick, market, which AU book, confidence Low/Medium/High]\n\nCLV EXPECTATION: [Will line move in your favour?]\n\nMULTI POTENTIAL: [Good multi leg or too risky?]\n\nVERDICT: [One sentence. No hedging.]";
  fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})
  })
  .then(function(r){return r.json();})
  .then(function(d) {
    var t="No analysis"; if(d.content) for(var i=0;i<d.content.length;i++) if(d.content[i].type==="text"){t=d.content[i].text;break;}
    S.aRes[gid]=t; renderPage();
  })
  .catch(function(e) { S.aRes[gid]="Error: "+e.message; renderPage(); });
}

function addBet() {
  function gv(id) { return document.getElementById("nb-"+id).value; }
  S.bets.push({
    id:Date.now(), date:gv("date"), sport:gv("sport"), game:gv("game"),
    pick:gv("pick"), betOdds:parseInt(gv("betOdds"))||0, closingOdds:parseInt(gv("closingOdds"))||0,
    result:gv("result"), bk:gv("bk"),
    stake:parseFloat((S.bankroll*kl(55,-110)*S.kf/100).toFixed(2))
  });
  uBar(); goTab("tracker");
}

function addLimit() {
  S.limits.push({
    id:Date.now(), bk:document.getElementById("nl-bk").value,
    orig:parseFloat(document.getElementById("nl-orig").value)||0,
    curr:parseFloat(document.getElementById("nl-curr").value)||0,
    date:document.getElementById("nl-date").value,
    notes:document.getElementById("nl-notes").value
  });
  uBar(); renderPage();
}

function mCalc() {
  var l=S.legs.filter(function(x){return x.odds&&x.wp>0;});
  if (l.length<2) return null;
  var d=l.reduce(function(a,x){return a*a2d(x.odds);},1);
  var p=l.reduce(function(a,x){return a*(x.wp/100);},1)*100;
  var ev=(p/100)*(d-1)-(1-p/100);
  var am=d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));
  return {d:d,p:p,ev:ev,am:am,allPos:l.every(function(x){return(x.wp-a2i(x.odds))>0;}),n:l.length};
}

function removeLeg(id) { S.legs=S.legs.filter(function(l){return l.id!==id;}); renderPage(); }
function addLeg() { S.legs.push({id:Date.now(),pick:"",odds:-110,wp:55}); renderPage(); }
function updateLeg(id,field,val) {
  S.legs=S.legs.map(function(l){
    if(l.id!==id)return l;
    var n={id:l.id,pick:l.pick,odds:l.odds,wp:l.wp}; n[field]=val; return n;
  }); renderPage();
}
function toggleGame(gid) { S.selGame=S.selGame===gid?null:gid; renderPage(); }
function setSport(which,sport) {
  if(which==="a"){S.aSport=sport;S.aOdds=[];S.aRes={};}
  else{S.oSport=sport;S.odds=[];S.selGame=null;}
  renderPage(); fetchOdds(which==="a"?S.aSport:S.oSport,which==="a"?"aOdds":"odds");
}
function setManual(gid,bk,val) {
  if(!S.mOdds[gid])S.mOdds[gid]={};
  S.mOdds[gid][bk]=val; renderPage();
}

function mc(label,value,color) {
  return '<div class="card" style="text-align:center;padding:12px"><div style="font-size:9px;color:#374151;margin-bottom:5px">'+label+'</div><div style="font-size:16px;font-weight:900;color:'+color+'">'+value+'</div></div>';
}
function met(label,value,sub,color) {
  return '<div class="card" style="position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,'+color+',transparent)"></div><div style="font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:4px">'+label+'</div><div style="font-size:22px;font-weight:900;color:'+color+';line-height:1">'+value+'</div><div style="font-size:10px;color:#4A5568;margin-top:4px">'+sub+'</div></div>';
}
function prBar(label,val,t,max) {
  var c=val>=t?"#4ECDC4":"#FF4757";
  return '<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:10px;color:#4A5568;margin-bottom:4px"><span>'+label+'</span><span style="color:'+c+'">'+val.toFixed(1)+'%</span></div><div style="height:3px;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+Math.min(val/max*100,100)+'%;background:'+c+';border-radius:3px"></div></div></div>';
}

function betCard(b) {
  var c2=cv(b.betOdds,b.closingOdds);
  var pnl=b.result==="W"?b.stake*(a2d(b.betOdds)-1):b.result==="L"?-b.stake:0;
  var li=S.limits.find(function(l){return l.bk===b.bk;});
  var bkObj=BOOKS.find(function(x){return x.k===b.bk;})||{c:"#6B7280"};
  var bc=b.result==="W"?"rgba(78,205,196,.15)":b.result==="L"?"rgba(255,71,87,.15)":"rgba(240,165,0,.15)";
  var rc=b.result==="W"?"#4ECDC4":b.result==="L"?"#FF4757":"#F0A500";
  return '<div class="card" style="border-color:'+bc+';margin-bottom:8px">'
    +'<div style="display:flex;justify-content:space-between;margin-bottom:6px">'
    +'<div><div style="display:flex;gap:6px;margin-bottom:3px;flex-wrap:wrap">'
    +'<span style="font-size:9px;color:'+(SC[b.sport]||"#FF6B35")+'">'+b.sport+'</span>'
    +'<span style="font-size:9px;color:#374151">'+b.date+'</span>'
    +'<span style="font-size:9px;color:'+bkObj.c+'">'+bl(b.bk)+'</span>'
    +(li?'<span style="font-size:9px;color:#FF4757;background:rgba(255,71,87,.1);padding:1px 5px;border-radius:3px">LIMITED $'+li.curr+'</span>':"")
    +'</div><div style="font-size:13px;font-weight:600">'+b.pick+'</div>'
    +'<div style="font-size:10px;color:#4A5568">'+b.game+'</div></div>'
    +'<div style="text-align:right;flex-shrink:0">'
    +'<div style="font-size:15px;font-weight:900;color:'+rc+'">'+(b.result==="P"?"PENDING":(pnl>=0?"+":"")+"$"+pnl.toFixed(2))+'</div>'
    +'<div style="font-size:9px;color:#374151">stake $'+b.stake.toFixed(2)+'</div></div></div>'
    +'<div style="display:flex;gap:12px;font-size:10px">'
    +'<span style="color:#4A5568">Bet <span style="color:#E8EAF0">'+fo(b.betOdds)+'</span></span>'
    +'<span style="color:#4A5568">Close <span style="color:#E8EAF0">'+fo(b.closingOdds)+'</span></span>'
    +'<span style="color:'+(c2>0?"#4ECDC4":"#FF4757")+'">CLV '+(c2>0?"+":"")+c2.toFixed(2)+'%</span>'
    +'</div></div>';
}

function bookSelect() {
  return BOOKS.map(function(b){return '<option value="'+b.k+'">'+b.l+'</option>';}).join("");
}

function sportBtns(which) {
  var cur = which==="a" ? S.aSport : S.oSport;
  return ["AFL","NBA","NFL"].map(function(sp){
    var a=cur===sp;
    return '<button class="btn" style="background:'+(a?SC[sp]+"18":"transparent")+';border:1px solid '+(a?SC[sp]:"rgba(255,255,255,.07)")+';color:'+(a?SC[sp]:"#374151")+'" onclick="setSport(\''+which+'\',\''+sp+'\')">'+sp+'</button>';
  }).join("");
}

function renderPage() {
  var pg=document.getElementById("pg"), st=sts(), t=S.tab;

  if (t==="dashboard") {
    var bh=[S.bankroll];
    var sorted=st.s.slice().sort(function(a,b){return new Date(a.date)-new Date(b.date);});
    sorted.forEach(function(b){
      var l=bh[bh.length-1];
      bh.push(b.result==="W"?l+b.stake*(a2d(b.betOdds)-1):b.result==="L"?l-b.stake:l);
    });
    var mn=Math.min.apply(null,bh), mx=Math.max.apply(null,bh), rng=mx-mn||1;
    var pts=bh.map(function(v,i){return ((i/(bh.length-1))*200)+","+(40-((v-mn)/rng)*40);}).join(" ");
    var col=st.p>=0?"#4ECDC4":"#FF4757";
    var rec="";
    S.bets.slice(-6).reverse().forEach(function(b){
      var c2=cv(b.betOdds,b.closingOdds), rc=b.result==="W"?"#4ECDC4":b.result==="L"?"#FF4757":"#F0A500";
      rec+='<div style="display:flex;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.03);gap:10px">'
        +'<div style="width:5px;height:5px;border-radius:50%;background:'+rc+';flex-shrink:0"></div>'
        +'<span style="font-size:9px;color:'+(SC[b.sport]||"#FF6B35")+';width:34px;flex-shrink:0">'+b.sport+'</span>'
        +'<span style="flex:1;font-size:11px;color:#9CA3AF;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+b.pick+'</span>'
        +'<span style="font-size:9px;color:#374151;flex-shrink:0">'+bl(b.bk)+'</span>'
        +'<span style="font-size:10px;color:'+(c2>0?"#4ECDC4":"#FF4757")+';flex-shrink:0">'+(c2>0?"+":"")+c2.toFixed(1)+'%</span>'
        +'<span style="font-size:11px;font-weight:700;color:'+rc+';width:16px;text-align:center">'+b.result+'</span></div>';
    });
    pg.innerHTML = '<div class="g2" style="margin-bottom:12px">'
      +met("WIN RATE",st.wr.toFixed(1)+"%",st.w+"W &middot; "+(st.s.length-st.w)+"L",st.wr>=52.4?"#4ECDC4":"#FF4757")
      +met("PROFIT",(st.p>=0?"+":"")+"$"+st.p.toFixed(0),(st.p/(S.bankroll*.0275)).toFixed(1)+" units",st.p>=0?"#FF6B35":"#FF4757")
      +met("AVG CLV",(st.ac>=0?"+":"")+st.ac.toFixed(2)+"%",st.cr.toFixed(0)+"% positive",st.ac>=0?"#4ECDC4":"#FF4757")
      +met("BETS",""+st.s.length,S.bets.filter(function(b){return b.result==="P";}).length+" pending","#F0A500")
      +'</div>'
      +'<div class="card" style="margin-bottom:12px">'
      +'<div style="font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:8px">BANKROLL GROWTH</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:10px;color:#4A5568;margin-bottom:6px">'
      +'<span>Start: $'+bh[0].toFixed(0)+'</span><span style="color:'+col+'">Now: $'+bh[bh.length-1].toFixed(0)+'</span></div>'
      +'<svg viewBox="0 0 200 40" style="width:100%;height:48px" preserveAspectRatio="none">'
      +'<polyline points="'+pts+'" fill="none" stroke="'+col+'" stroke-width="1.5" stroke-linejoin="round"/>'
      +'<polyline points="0,40 '+pts+' 200,40" fill="'+col+'12" stroke="none"/></svg></div>'
      +'<div style="background:rgba(255,107,53,.03);border:1px solid rgba(255,107,53,.12);border-radius:12px;padding:14px;margin-bottom:12px">'
      +'<div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:10px">EDGE HEALTH</div>'
      +prBar("Win Rate vs Breakeven 52.4%",st.wr,52.4,65)
      +prBar("CLV Positive Rate",st.cr,50,100)
      +prBar("Sample Confidence (1000+ target)",Math.min(st.s.length/10,100),50,100)
      +'</div>'
      +'<div class="card" style="padding:16px 16px 6px">'
      +'<div style="font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:10px">RECENT BETS</div>'
      +rec+'</div>';
  }

  else if (t==="tracker") {
    var cards=""; S.bets.slice().reverse().forEach(function(b){cards+=betCard(b);});
    pg.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      +'<div style="font-size:9px;color:#374151;letter-spacing:2px">'+S.bets.length+' BETS LOGGED</div>'
      +'<button class="btn o" onclick="document.getElementById(\'abf\').classList.toggle(\'hidden\')">+ LOG BET</button></div>'
      +'<div id="abf" class="hidden card" style="margin-bottom:12px">'
      +'<div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:10px">NEW BET</div>'
      +'<div class="g2">'
      +'<div><label class="lbl">DATE</label><input type="date" id="nb-date"></div>'
      +'<div><label class="lbl">GAME</label><input type="text" id="nb-game" placeholder="Team A vs B"></div>'
      +'<div><label class="lbl">PICK</label><input type="text" id="nb-pick" placeholder="e.g. Lakers -3.5"></div>'
      +'<div><label class="lbl">BET ODDS</label><input type="number" id="nb-betOdds" value="-110"></div>'
      +'<div><label class="lbl">CLOSING ODDS</label><input type="number" id="nb-closingOdds" value="-110"></div>'
      +'<div><label class="lbl">SPORT</label><select id="nb-sport"><option>AFL</option><option>NBA</option><option>NFL</option></select></div>'
      +'<div><label class="lbl">BOOKMAKER</label><select id="nb-bk">'+bookSelect()+'</select></div>'
      +'<div><label class="lbl">RESULT</label><select id="nb-result"><option value="P">Pending</option><option value="W">Win</option><option value="L">Loss</option></select></div>'
      +'</div><button class="btn prim" onclick="addBet()">LOG BET</button></div>'+cards;
  }

  else if (t==="analysis") {
    var gc = S.aOdds.length===0 ? '<div style="text-align:center;padding:40px;color:#374151">Select a sport and hit REFRESH.</div>' : "";
    S.aOdds.forEach(function(g) {
      var gt=new Date(g.commence_time), pH=null;
      (g.bookmakers||[]).forEach(function(bm){if(bm.key==="pinnacle")(bm.markets||[]).forEach(function(m){if(m.key==="h2h")pH=m;});});
      var phtml=pH?'<div style="display:flex;gap:10px;margin-top:6px;font-size:10px;flex-wrap:wrap">'
        +pH.outcomes.map(function(o){return'<span style="color:#4ECDC4">'+o.name+': <strong>'+fo(o.price)+'</strong></span>';}).join("")
        +'<span style="color:#374151">&middot; Pinnacle</span></div>':"";
      var res=S.aRes[g.id], loading=res==="LOADING";
      var rh=res&&res!=="LOADING"?'<div style="background:rgba(255,107,53,.04);border:1px solid rgba(255,107,53,.18);border-radius:10px;padding:14px;margin-top:10px">'
        +'<div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:10px">AI ANALYSIS &middot; CLAUDE</div>'
        +'<div style="font-size:12px;color:#D1D5DB;line-height:1.9;white-space:pre-wrap">'+res+'</div>'
        +'<button class="btn o" style="margin-top:12px" onclick="goTab(\'tracker\')">+ LOG THIS BET</button></div>':"";
      gc += '<div class="card" style="margin-bottom:12px">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px"><div>'
        +'<div style="font-size:9px;color:#374151;margin-bottom:3px">'+gt.toLocaleDateString("en-AU")+" "+gt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+'</div>'
        +'<div style="font-size:14px;font-weight:700">'+g.away_team+'</div>'
        +'<div style="font-size:11px;color:#4A5568">@ '+g.home_team+'</div>'+phtml+'</div>'
        +'<button class="btn o" '+(loading?"disabled ":"")+' onclick="runAnalysis(\''+g.id+'\')">'+(loading?"ANALYSING...":"ANALYSE")+'</button></div>'+rh+'</div>';
    });
    pg.innerHTML = '<div style="padding:10px 14px;background:rgba(78,205,196,.05);border:1px solid rgba(78,205,196,.14);border-radius:10px;font-size:11px;color:#4ECDC4;margin-bottom:14px;line-height:1.6">Claude analyses each game using live Pinnacle odds + deep knowledge of team form, stats and matchup history.</div>'
      +'<div style="display:flex;gap:6px;margin-bottom:12px;align-items:center">'+sportBtns("a")
      +'<button class="btn tc" style="margin-left:auto" onclick="S.aOdds=[];fetchOdds(S.aSport,\'aOdds\')">REFRESH</button></div>'+gc;
  }

  else if (t==="multi") {
    var mc2=mCalc(), lh="";
    S.legs.forEach(function(leg,i){
      var le=leg.wp-a2i(leg.odds), ec=le>0?"#4ECDC4":"#FF4757";
      lh += '<div class="card" style="margin-bottom:10px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
        +'<div style="font-size:10px;color:#FF6B35;letter-spacing:2px">LEG '+(i+1)+'</div>'
        +(S.legs.length>2?'<button class="btn r" style="padding:3px 8px;font-size:9px" onclick="removeLeg('+leg.id+')">X</button>':"")
        +'</div><div class="g3">'
        +'<div style="grid-column:1/-1"><label class="lbl">PICK</label><input type="text" value="'+leg.pick+'" placeholder="e.g. Collingwood -9.5" onchange="updateLeg('+leg.id+',\'pick\',this.value)"></div>'
        +'<div><label class="lbl">ODDS</label><input type="number" value="'+leg.odds+'" style="text-align:center;font-size:14px;font-weight:700" onchange="updateLeg('+leg.id+',\'odds\',parseInt(this.value)||0)"></div>'
        +'<div><label class="lbl">WIN PROB %</label><input type="number" value="'+leg.wp+'" style="text-align:center;font-size:14px;font-weight:700" onchange="updateLeg('+leg.id+',\'wp\',parseFloat(this.value)||0)"></div>'
        +'<div><label class="lbl">LEG EDGE</label><div style="padding:8px;background:rgba(255,255,255,.03);border-radius:6px;text-align:center;font-size:13px;font-weight:700;color:'+ec+'">'+(le>0?"+":"")+le.toFixed(2)+'%</div></div>'
        +'</div></div>';
    });
    var mh="";
    if (mc2) {
      var mclr=mc2.ev>0?"#4ECDC4":"#FF4757";
      mh = '<div style="background:'+(mc2.ev>0?"rgba(78,205,196,.05)":"rgba(255,71,87,.05)")+';border:1px solid '+(mc2.ev>0?"rgba(78,205,196,.2)":"rgba(255,71,87,.2)")+';border-radius:12px;padding:16px">'
        +'<div style="font-size:9px;color:'+mclr+';letter-spacing:2px;margin-bottom:14px">'+(mc2.ev>0?"POSITIVE EV MULTI":"NEGATIVE EV MULTI")+'</div>'
        +'<div class="g3" style="margin-bottom:14px">'+mc("COMBINED ODDS",fo(mc2.am),"#FF6B35")+mc("WIN PROBABILITY",mc2.p.toFixed(2)+"%","#F0A500")+mc("EXPECTED VALUE",(mc2.ev>=0?"+":"")+mc2.ev.toFixed(3),mclr)+'</div>'
        +'<div style="font-size:11px;line-height:1.7;color:'+mclr+'">'+(mc2.ev>0?"Positive EV "+mc2.n+"-leg multi. Max stake: $"+(S.bankroll*.01).toFixed(2)+" (1% bankroll).":(mc2.allPos?"Combined vig destroys edge.":"One or more legs have no edge. Fix first.")+" Do not place this multi.")+'</div></div>';
    }
    pg.innerHTML = '<div style="padding:10px 14px;background:rgba(78,205,196,.04);border:1px solid rgba(78,205,196,.12);border-radius:10px;font-size:11px;color:#4ECDC4;margin-bottom:14px;line-height:1.6">Enter each leg\'s odds and win probability. Shows whether combining has positive expected value.</div>'
      +lh+'<button class="btn tc" style="width:100%;margin-bottom:14px;padding:10px;text-align:center" onclick="addLeg()">+ ADD LEG</button>'+mh;
  }

  else if (t==="kelly") {
    pg.innerHTML = '<div style="background:rgba(255,107,53,.03);border:1px solid rgba(255,107,53,.12);border-radius:12px;padding:18px;margin-bottom:12px">'
      +'<div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:14px">KELLY CRITERION</div>'
      +'<div class="g2" style="margin-bottom:14px">'
      +'<div><label class="lbl">WIN PROBABILITY %</label><input type="number" id="kw" value="55" style="text-align:center;font-size:17px;font-weight:700;color:#FF6B35;border-color:rgba(255,107,53,.33)" oninput="uKelly()"></div>'
      +'<div><label class="lbl">BET ODDS</label><input type="number" id="ko" value="-110" style="text-align:center;font-size:17px;font-weight:700;color:#FF6B35;border-color:rgba(255,107,53,.33)" oninput="uKelly()"></div>'
      +'</div>'
      +'<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:10px;color:#4A5568;margin-bottom:6px"><span>KELLY FRACTION</span><span id="kfl" style="color:#FF6B35">'+(S.kf*100).toFixed(0)+'%</span></div>'
      +'<input type="range" min="0.1" max="1" step="0.05" value="'+S.kf+'" oninput="S.kf=parseFloat(this.value);var e=document.getElementById(\'kfl\');if(e)e.textContent=(S.kf*100).toFixed(0)+\'%\';uKelly()"></div>'
      +'<div class="g3" id="kr"></div><div id="kw2"></div></div>'
      +'<div style="background:rgba(78,205,196,.03);border:1px solid rgba(78,205,196,.1);border-radius:12px;padding:16px">'
      +'<div style="font-size:9px;color:#4ECDC4;letter-spacing:2px;margin-bottom:12px">PROJECTED GROWTH &middot; 55% WR &middot; 3 BETS/DAY</div>'
      +'<div class="g3" id="kp"></div></div>';
    uKelly();
  }

  else if (t==="clv") {
    var allc="";
    S.bets.forEach(function(b){
      var c2=cv(b.betOdds,b.closingOdds);
      allc += '<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.03)">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:4px">'
        +'<div><span style="font-size:9px;color:'+(SC[b.sport]||"#FF6B35")+';margin-right:8px">'+b.sport+'</span><span style="font-size:11px;color:#9CA3AF">'+b.pick+'</span></div>'
        +'<span style="font-size:11px;font-weight:700;color:'+(c2>=0?"#4ECDC4":"#FF4757")+'">'+(c2>=0?"+":"")+c2.toFixed(2)+'%</span></div>'
        +'<div style="height:2px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+Math.min(Math.abs(c2)*15,100)+'%;background:'+(c2>=0?"#4ECDC4":"#FF4757")+';border-radius:2px"></div></div></div>';
    });
    var st2=sts();
    pg.innerHTML = '<div style="background:rgba(69,183,209,.03);border:1px solid rgba(69,183,209,.14);border-radius:12px;padding:18px;margin-bottom:12px">'
      +'<div style="font-size:9px;color:#45B7D1;letter-spacing:2px;margin-bottom:14px">CLV &mdash; PINNACLE BENCHMARK</div>'
      +'<div style="padding:8px 12px;background:rgba(78,205,196,.05);border-radius:6px;font-size:11px;color:#4ECDC4;margin-bottom:12px">Beat Pinnacle\'s close = verified edge.</div>'
      +'<div class="g2" style="margin-bottom:12px">'
      +'<div><label class="lbl">YOUR BET ODDS</label><input type="number" id="cb" value="-110" style="text-align:center;font-size:17px;font-weight:700;color:#45B7D1;border-color:rgba(69,183,209,.33)" oninput="uCLV()"></div>'
      +'<div><label class="lbl">PINNACLE CLOSING ODDS</label><input type="number" id="cc" value="-115" style="text-align:center;font-size:17px;font-weight:700;color:#45B7D1;border-color:rgba(69,183,209,.33)" oninput="uCLV()"></div>'
      +'</div><div class="g3" id="clvr" style="margin-bottom:12px"></div><div id="clvv"></div></div>'
      +'<div class="card" style="padding:16px 16px 6px">'
      +'<div style="font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:10px">ALL BETS &middot; AVG CLV <span style="color:'+(st2.ac>=0?"#4ECDC4":"#FF4757")+'">'+(st2.ac>=0?"+":"")+st2.ac.toFixed(2)+'%</span></div>'+allc+'</div>';
    uCLV();
  }

  else if (t==="odds") {
    var gh="";
    if (S.oddsErr) gh='<div style="padding:12px;background:rgba(255,71,87,.06);border:1px solid rgba(255,71,87,.18);border-radius:8px;color:#FF4757;font-size:12px;margin-bottom:12px">Error: '+S.oddsErr+'</div>';
    if (S.odds.length===0&&!S.oddsErr) gh+='<div style="text-align:center;padding:50px;color:#374151">Select a sport and hit REFRESH.</div>';
    S.odds.forEach(function(g) {
      var gt=new Date(g.commence_time), isOpen=S.selGame===g.id, gm=S.mOdds[g.id]||{};
      var allH2H=[];
      (g.bookmakers||[]).forEach(function(bm){var m=bm.markets&&bm.markets.find(function(x){return x.key==="h2h";});if(m)allH2H=allH2H.concat(m.outcomes||[]);});
      var bestP=allH2H.length?Math.max.apply(null,allH2H.map(function(o){return o.price;})):null;
      var manH='<div style="margin-bottom:14px;background:rgba(255,107,53,.03);border-radius:8px;padding:10px">'
        +'<div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:8px">MANUAL AU BOOK ODDS</div><div class="g4">';
      MB.forEach(function(bk){
        var bi=BOOKS.find(function(x){return x.k===bk;})||{l:bk}, val=gm[bk]||"", pinP=null;
        (g.bookmakers||[]).forEach(function(bm){if(bm.key==="pinnacle"){var pm=bm.markets&&bm.markets.find(function(x){return x.key==="h2h";});if(pm&&pm.outcomes[0])pinP=pm.outcomes[0].price;}});
        var edge=val&&pinP&&parseInt(val)>pinP;
        manH+='<div style="background:'+(edge?"rgba(78,205,196,.07)":"rgba(255,255,255,.02)")+';border:1px solid '+(edge?"rgba(78,205,196,.25)":"rgba(255,255,255,.05)")+';border-radius:6px;padding:7px">'
          +'<div style="font-size:9px;color:#374151;margin-bottom:3px">'+bi.l+'</div>'
          +'<input type="number" placeholder="-110" value="'+val+'" style="width:100%;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,.08);color:'+(edge?"#4ECDC4":"#E8EAF0")+';font-size:12px;font-weight:700;font-family:inherit;outline:none;padding:2px 0;box-sizing:border-box" onchange="setManual(\''+g.id+'\',\''+bk+'\',this.value)">'
          +(edge?'<div style="font-size:8px;color:#4ECDC4;margin-top:2px">BEATS PIN</div>':"")+'</div>';
      });
      manH+='</div></div>';
      var mkts="";
      ["h2h","spreads","totals"].forEach(function(mkey){
        var hasMkt=false;
        (g.bookmakers||[]).forEach(function(bm){if(bm.markets&&bm.markets.find(function(x){return x.key===mkey;}))hasMkt=true;});
        if (!hasMkt) return;
        var mclrs={"h2h":"#FF6B35","spreads":"#45B7D1","totals":"#F0A500"};
        var mlbls={"h2h":"MONEYLINE","spreads":"SPREAD","totals":"TOTAL"};
        var sides=mkey==="totals"?["Over","Under"]:[g.away_team,g.home_team];
        mkts+='<div style="margin-bottom:12px"><div style="font-size:9px;color:'+mclrs[mkey]+';letter-spacing:2px;margin-bottom:8px">'+mlbls[mkey]+'</div><div class="g2">';
        sides.forEach(function(side,ti){
          var bms=[];
          (g.bookmakers||[]).forEach(function(bm){
            var bmkt=bm.markets&&bm.markets.find(function(x){return x.key===mkey;});if(!bmkt)return;
            var o=mkey==="totals"?bmkt.outcomes.find(function(x){return x.name===side;}):bmkt.outcomes[ti];
            if(o)bms.push({key:bm.key,price:o.price,point:o.point});
          });
          var bp=bms.length?Math.max.apply(null,bms.map(function(x){return x.price;})):-999;
          var bmsH="";
          bms.forEach(function(bm){
            var ib=bm.price===bp;
            bmsH+='<div style="background:'+(ib?mclrs[mkey]+"18":"rgba(255,255,255,.03)")+';border:1px solid '+(ib?mclrs[mkey]+"44":"rgba(255,255,255,.05)")+';border-radius:6px;padding:5px 7px;text-align:center">'
              +'<div style="font-size:8px;color:#374151">'+bm.key.replace("_au","").slice(0,4).toUpperCase()+'</div>'
              +(mkey!=="h2h"?'<div style="font-size:9px;color:#4A5568">'+(bm.point>0?"+":"")+bm.point+'</div>':"")
              +'<div style="font-size:12px;font-weight:700;color:'+(ib?mclrs[mkey]:"#E8EAF0")+'">'+fo(bm.price)+'</div></div>';
          });
          mkts+='<div style="background:rgba(255,255,255,.02);border-radius:8px;padding:10px"><div style="font-size:10px;color:#6B7280;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+side+'</div><div style="display:flex;gap:5px;flex-wrap:wrap">'+bmsH+'</div></div>';
        });
        mkts+='</div></div>';
      });
      gh+='<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px;border-color:'+(isOpen?"rgba(255,107,53,.28)":"rgba(255,255,255,.07)")+'">'
        +'<div onclick="toggleGame(\''+g.id+'\')" style="padding:12px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><div>'
        +'<div style="font-size:9px;color:#374151;margin-bottom:3px">'+gt.toLocaleDateString("en-AU")+" "+gt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+'</div>'
        +'<div style="font-size:13px;font-weight:700">'+g.away_team+'</div>'
        +'<div style="font-size:10px;color:#4A5568">@ '+g.home_team+'</div></div>'
        +'<div style="text-align:right">'+(bestP?'<div style="font-size:11px;color:#4ECDC4">Best '+fo(bestP)+'</div>':"")
        +'<div style="font-size:11px;color:#FF6B35;margin-top:3px">'+(isOpen?"^":"v")+'</div></div></div>'
        +(isOpen?'<div style="border-top:1px solid rgba(255,255,255,.05);padding:12px 14px">'+manH+mkts+'<div style="font-size:10px;color:#1F2937;margin-top:8px">Green = best line. Enter AU book odds above to compare vs Pinnacle.</div></div>':"")
        +'</div>';
    });
    pg.innerHTML = '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center">'+sportBtns("o")
      +'<button class="btn tc" style="margin-left:auto" onclick="S.odds=[];S.selGame=null;fetchOdds(S.oSport,\'odds\')">REFRESH</button></div>'
      +'<div style="padding:8px 12px;background:rgba(78,205,196,.04);border:1px solid rgba(78,205,196,.1);border-radius:8px;font-size:10px;color:#4A5568;margin-bottom:10px;display:flex;justify-content:space-between">'
      +'<span>Live odds via Railway &middot; Enter AU book odds manually</span><span>'+(S.remReq?S.remReq+"/500":"")+'</span></div>'+gh;
  }

  else if (t==="books") {
    var bkcards="";
    BOOKS.forEach(function(bk){
      var bb=st.s.filter(function(b){return b.bk===bk.k;});
      var bw=bb.filter(function(b){return b.result==="W";}).length;
      var bwr=bb.length?bw/bb.length*100:0;
      var bpr=bb.reduce(function(a,b){return b.result==="W"?a+b.stake*(a2d(b.betOdds)-1):b.result==="L"?a-b.stake:a;},0);
      var bcv=bb.reduce(function(a,b){return a+cv(b.betOdds,b.closingOdds);},0)/(bb.length||1);
      var li=S.limits.find(function(l){return l.bk===bk.k;}), risk=bb.length>=30&&bwr>=58;
      bkcards+='<div class="card" style="border-color:'+(li?"rgba(255,71,87,.22)":risk?"rgba(240,165,0,.22)":"rgba(255,255,255,.07)")+';margin-bottom:10px">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px"><div>'
        +'<div style="display:flex;gap:7px;align-items:center;margin-bottom:4px">'
        +'<span style="font-size:13px;font-weight:700;color:'+bk.c+'">'+bk.l+'</span>'
        +'<span style="font-size:9px;color:'+bk.c+';background:'+bk.c+'14;padding:2px 6px;border-radius:4px">'+bk.t+'</span>'
        +(li?'<span style="font-size:9px;color:#FF4757;background:rgba(255,71,87,.1);padding:2px 6px;border-radius:4px">LIMITED</span>':"")
        +(risk&&!li?'<span style="font-size:9px;color:#F0A500;background:rgba(240,165,0,.1);padding:2px 6px;border-radius:4px">AT RISK</span>':"")
        +'</div>'+(li?'<div style="font-size:11px;color:#FF4757">$'+li.orig+' to $'+li.curr+' max &middot; '+li.date+'</div>':"")
        +(risk&&!li?'<div style="font-size:11px;color:#F0A500">'+bwr.toFixed(1)+'% WR &mdash; reduce stake now</div>':"")
        +'</div><div style="text-align:right"><div style="font-size:14px;font-weight:900;color:'+(bpr>=0?"#4ECDC4":"#FF4757")+'">'+(bpr>=0?"+":"")+"$"+bpr.toFixed(0)+'</div>'
        +'<div style="font-size:9px;color:#374151">'+bb.length+' bets</div></div></div>'
        +'<div class="g3">'+mc("WIN RATE",bwr.toFixed(1)+"%",bwr>=52.4?"#4ECDC4":"#FF4757")+mc("AVG CLV",(bcv>=0?"+":"")+bcv.toFixed(2)+"%",bcv>=0?"#4ECDC4":"#FF4757")+mc("STATUS",li?"$"+li.curr+" MAX":"ACTIVE",li?"#FF4757":"#4ECDC4")+'</div></div>';
    });
    pg.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      +'<div style="font-size:9px;color:#374151;letter-spacing:2px">BOOKMAKER HEALTH</div>'
      +'<button class="btn r" onclick="document.getElementById(\'alf\').classList.toggle(\'hidden\')">+ LOG LIMIT</button></div>'
      +'<div id="alf" class="hidden card" style="margin-bottom:12px"><div class="g2">'
      +'<div><label class="lbl">BOOKMAKER</label><select id="nl-bk">'+bookSelect()+'</select></div>'
      +'<div><label class="lbl">DATE</label><input type="date" id="nl-date"></div>'
      +'<div><label class="lbl">ORIGINAL MAX $</label><input type="number" id="nl-orig" placeholder="100"></div>'
      +'<div><label class="lbl">CURRENT MAX $</label><input type="number" id="nl-curr" placeholder="20"></div>'
      +'<div style="grid-column:1/-1"><label class="lbl">NOTES</label><input type="text" id="nl-notes" placeholder="Reason..."></div>'
      +'</div><button class="btn r" style="width:100%;margin-top:10px;padding:10px;font-size:11px;font-weight:700" onclick="addLimit()">LOG LIMIT</button></div>'+bkcards;
  }

  else if (t==="settings") {
    pg.innerHTML = '<div style="font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:14px">SETTINGS</div>'
      +'<div class="card" style="margin-bottom:10px"><label class="lbl">BANKROLL $</label>'
      +'<input type="number" value="'+S.bankroll+'" onchange="S.bankroll=parseFloat(this.value)||0;document.getElementById(\'bk-inp\').value=S.bankroll;uBar()"></div>'
      +'<div class="card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:10px;color:#4A5568;margin-bottom:8px">'
      +'<span>KELLY FRACTION</span><span style="color:#FF6B35">'+(S.kf*100).toFixed(0)+'%</span></div>'
      +'<input type="range" min="0.1" max="1" step="0.05" value="'+S.kf+'" oninput="S.kf=parseFloat(this.value)"></div>'
      +'<div class="card" style="background:rgba(255,107,53,.03);border:1px solid rgba(255,107,53,.12)">'
      +'<div style="font-size:9px;color:#FF6B35;letter-spacing:2px;margin-bottom:12px">DATA SOURCES</div>'
      +[{name:"The Odds API",status:"Live odds &middot; NFL, NBA, AFL &middot; via this server",color:"#4ECDC4"},
        {name:"Anthropic Claude",status:"AI analysis &middot; Game insights &middot; Multi EV",color:"#FF6B35"},
        {name:"Railway Server",status:"This app &mdash; no restrictions, always on",color:"#4ECDC4"}]
      .map(function(src){
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          +'<div><div style="font-size:12px;font-weight:600">'+src.name+'</div><div style="font-size:10px;color:#4A5568">'+src.status+'</div></div>'
          +'<div style="font-size:9px;color:'+src.color+';background:'+src.color+'14;padding:2px 8px;border-radius:4px">ACTIVE</div></div>';
      }).join("")+'</div>';
  }

  uBar();
}

function uKelly() {
  var wp=parseFloat((document.getElementById("kw")||{value:55}).value);
  var bo=parseInt((document.getElementById("ko")||{value:-110}).value);
  var edge=(wp-a2i(bo)).toFixed(2), hk=kl(wp,bo)*S.kf, bs=(S.bankroll*hk/100).toFixed(2);
  var r=document.getElementById("kr");
  if(r) r.innerHTML=mc("EDGE",(parseFloat(edge)>0?"+":"")+edge+"%",parseFloat(edge)>0?"#4ECDC4":"#FF4757")+mc("KELLY %",hk.toFixed(2)+"%","#FF6B35")+mc("BET SIZE","$"+bs,"#F0A500");
  var w=document.getElementById("kw2");
  if(w) w.innerHTML=parseFloat(edge)<=0?'<div style="margin-top:10px;padding:9px 12px;background:rgba(255,71,87,.06);border:1px solid rgba(255,71,87,.18);border-radius:8px;font-size:11px;color:#FF4757">NEGATIVE EDGE &mdash; DO NOT BET.</div>':"";
  var p=document.getElementById("kp");
  if(p){
    var ph="";
    [{p:"1 MONTH",n:90},{p:"3 MONTHS",n:270},{p:"1 YEAR",n:1095}].forEach(function(x){
      var w2=Math.round(x.n*.55), st2=parseFloat(bs), prf=w2*st2*(a2d(bo)-1)-(x.n-w2)*st2;
      ph+=mc(x.p,"$"+(S.bankroll+prf).toFixed(0),prf>=0?"#4ECDC4":"#FF4757");
    });
    p.innerHTML=ph;
  }
}

function uCLV() {
  var b=parseInt((document.getElementById("cb")||{value:-110}).value);
  var c=parseInt((document.getElementById("cc")||{value:-115}).value);
  var cvv=cv(b,c);
  var r=document.getElementById("clvr");
  if(r) r.innerHTML=mc("YOUR IMPLIED",a2i(b).toFixed(1)+"%","#45B7D1")+mc("PINNACLE CLOSE",a2i(c).toFixed(1)+"%","#45B7D1")+mc("CLV",(cvv>=0?"+":"")+cvv.toFixed(2)+"%",cvv>=0?"#4ECDC4":"#FF4757");
  var v=document.getElementById("clvv");
  if(v) v.innerHTML='<div style="padding:10px 12px;background:'+(cvv>=0?"rgba(78,205,196,.05)":"rgba(255,71,87,.05)")+';border:1px solid '+(cvv>=0?"rgba(78,205,196,.16)":"rgba(255,71,87,.16)")+';border-radius:8px;font-size:11px;color:'+(cvv>=0?"#4ECDC4":"#FF4757")+'">'+(cvv>=0?"POSITIVE CLV &mdash; Verified edge.":"NEGATIVE CLV &mdash; Market moved against you.")+'</div>';
}

renderTabs();
renderPage();
