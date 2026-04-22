// ═══════════════════════════════════════════════════════════
//  EDGE//STACK v3 — Betting Intelligence Platform
// ═══════════════════════════════════════════════════════════

// ── Constants ────────────────────────────────────────────────
var BOOKS = [
  {k:"pinnacle",  l:"Pinnacle",  t:"SHARP", c:"#4ECDC4"},
  {k:"sportsbet", l:"Sportsbet", t:"SOFT",  c:"#FF6B35"},
  {k:"ladbrokes", l:"Ladbrokes", t:"SOFT",  c:"#FF6B35"},
  {k:"neds",      l:"Neds",      t:"SOFT",  c:"#FF6B35"},
  {k:"tab",       l:"TAB",       t:"SEMI",  c:"#F0A500"},
  {k:"betnation", l:"BetNation", t:"SOFT",  c:"#FF6B35"}
];
var SOFT_BOOKS = ["sportsbet","ladbrokes","neds","tab","betnation"];
var SC = {NBA:"#FF6B35", NFL:"#4ECDC4", AFL:"#00A86B", NRL:"#9B59B6", MLB:"#E74C3C"};
var SK = {
  NBA:"basketball_nba",
  NFL:"americanfootball_nfl",
  AFL:"aussierules_afl",
  NRL:"rugbyleague_nrl",
  MLB:"baseball_mlb"
};
var SPORTS = ["AFL","NBA","NFL","NRL","MLB"];
var TABS = [
  {id:"dashboard", label:"Dashboard"},
  {id:"value",     label:"Value Bets"},
  {id:"upnext",    label:"Up Next"},
  {id:"tracker",   label:"Tracker"},
  {id:"pending",   label:"Pending"},
  {id:"analysis",  label:"AI Analysis"},
  {id:"multi",     label:"Multi EV"},
  {id:"kelly",     label:"Kelly"},
  {id:"clv",       label:"CLV"},
  {id:"odds",      label:"Live Odds"},
  {id:"books",     label:"Account Health"},
  {id:"breakdown", label:"Breakdown"},
  {id:"settings",  label:"Settings"}
];

// ── State ────────────────────────────────────────────────────
var S = {
  tab: "dashboard",
  bankroll: 1000,
  kf: 0.25,
  bets: [],
  limits: [
    {id:1, bk:"sportsbet", orig:500, curr:50, date:"2024-01-10", notes:"Limited after 3 week winning run", history:[500,200,100,50]}
  ],
  odds: {},
  aOdds: [],
  aRes: {},
  selGame: null,
  mOdds: {},
  legs: [{id:1,pick:"",odds:2.0,wp:55,sport:"AFL"},{id:2,pick:"",odds:2.0,wp:55,sport:"AFL"}],
  aSport: "AFL",
  oSport: "AFL",
  vSport: "AFL",
  remReq: null,
  oddsErr: null,
  news: {},
  streak: 0,
  pendingBets: []
};

// ── Math ──────────────────────────────────────────────────────
// Decimal odds only (converted from American on server side)
function d2i(d) { return d > 0 ? (1/d)*100 : 0; }
function i2d(pct) { return pct > 0 ? 100/pct : 0; }

// Strip Pinnacle margin — simple margin removal (industry standard for these markets)
function stripMargin(outcomes) {
  if (!outcomes || outcomes.length === 0) return [];
  var total = outcomes.reduce(function(a,o){ return a + d2i(o.price); }, 0);
  if (total <= 0) return outcomes;
  return outcomes.map(function(o) {
    var trueProb = d2i(o.price) / total * 100;
    return { name: o.name, price: o.price, trueProb: trueProb, fairOdds: parseFloat((100/trueProb).toFixed(2)), point: o.point };
  });
}

function calcEV(bookOdds, trueProb) {
  // EV = (P * payout) - (1 - P)
  var p = trueProb / 100;
  return parseFloat(((p * (bookOdds - 1)) - (1 - p)).toFixed(4));
}

function kellyStake(trueProb, bookOdds, fraction) {
  fraction = fraction || S.kf;
  var p = trueProb / 100;
  var b = bookOdds - 1;
  var q = 1 - p;
  var k = (b * p - q) / b;
  return Math.max(0, k * fraction * 100); // returns % of bankroll
}

function calcCLV(betOdds, closeOdds) {
  if (!betOdds || !closeOdds) return 0;
  return parseFloat((d2i(closeOdds) - d2i(betOdds)).toFixed(2));
}

function fmtOdds(d) {
  if (!d) return "-";
  return parseFloat(d).toFixed(2);
}

function fmtPct(n) {
  return (n >= 0 ? "+" : "") + parseFloat(n).toFixed(2) + "%";
}

function bookLabel(k) {
  var b = BOOKS.find(function(x){ return x.k === k; });
  return b ? b.l : k;
}

function bookColor(k) {
  var b = BOOKS.find(function(x){ return x.k === k; });
  return b ? b.c : "#6B7280";
}

function confidenceLabel(ev) {
  if (ev >= 0.08) return "HIGH";
  if (ev >= 0.04) return "MEDIUM";
  return "LOW";
}

function confidenceColor(ev) {
  if (ev >= 0.08) return "#4ECDC4";
  if (ev >= 0.04) return "#F0A500";
  return "#FF6B35";
}

function sampleConfidence(n) {
  if (n >= 500) return 95;
  if (n >= 200) return 80;
  if (n >= 100) return 65;
  if (n >= 50)  return 45;
  if (n >= 20)  return 25;
  return Math.round(n / 20 * 25);
}

function correlationFlag(legs) {
  var flags = [];
  var sports = legs.map(function(l){ return l.sport; });
  var sameGame = legs.filter(function(l){ return l.sport === legs[0].sport; }).length === legs.length;
  if (sameGame && legs.length > 1) {
    flags.push("Same sport legs may be correlated — combined probability could be overstated");
  }
  legs.forEach(function(l) {
    if (l.pick && l.pick.toLowerCase().indexOf("player") >= 0) {
      flags.push("Player prop detected — verify independence from team result");
    }
  });
  return flags;
}

// ── Computed Stats ────────────────────────────────────────────
function settledBets() { return S.bets.filter(function(b){ return b.result !== "P"; }); }

function globalStats() {
  var s = settledBets();
  var w = s.filter(function(b){ return b.result === "W"; }).length;
  var wr = s.length ? w/s.length*100 : 0;
  var profit = s.reduce(function(a,b){
    return b.result === "W" ? a + b.stake*(b.betOdds-1) : b.result === "L" ? a - b.stake : a;
  }, 0);
  var avgCLV = s.reduce(function(a,b){ return a + calcCLV(b.betOdds, b.closingOdds); }, 0) / (s.length || 1);
  var clvPos = s.length ? s.filter(function(b){ return calcCLV(b.betOdds,b.closingOdds) > 0; }).length / s.length * 100 : 0;
  var avgEV = s.reduce(function(a,b){ return a + (b.ev || 0); }, 0) / (s.length || 1);
  var conf = sampleConfidence(s.length);
  // Streak
  var streak = 0;
  for (var i = S.bets.length-1; i >= 0; i--) {
    if (S.bets[i].result === "P") continue;
    if (S.bets[i].result === "L") streak++;
    else break;
  }
  return { s:s, w:w, wr:wr, profit:profit, avgCLV:avgCLV, clvPos:clvPos, avgEV:avgEV, conf:conf, streak:streak, total:s.length };
}

// ── API Calls ─────────────────────────────────────────────────
function fetchOdds(sport, callback) {
  fetch("/api/odds/" + SK[sport] + "?regions=us,au,uk&markets=h2h,spreads,totals")
    .then(function(r) {
      var rem = r.headers.get("x-requests-remaining");
      if (rem) S.remReq = rem;
      return r.json();
    })
    .then(function(d) {
      S.odds[sport] = d;
      S.oddsErr = null;
      if (callback) callback(d);
    })
    .catch(function(e) {
      S.oddsErr = e.message;
      if (callback) callback([]);
    });
}

function runAnalysis(gameId, sport, contextNews) {
  var g = (S.aOdds || []).find(function(x){ return x.id === gameId; });
  if (!g) return;
  S.aRes[gameId] = "LOADING";
  renderPage();

  var pinH2H = null, pinSpread = null, pinTotal = null;
  (g.bookmakers||[]).forEach(function(bm) {
    if (bm.key !== "pinnacle") return;
    (bm.markets||[]).forEach(function(m) {
      if (m.key === "h2h") pinH2H = m;
      if (m.key === "spreads") pinSpread = m;
      if (m.key === "totals") pinTotal = m;
    });
  });

  var fairPrices = pinH2H ? stripMargin(pinH2H.outcomes) : [];
  var oddsLines = [];
  if (pinH2H) oddsLines.push("H2H: " + pinH2H.outcomes.map(function(o){ return o.name + " @ " + fmtOdds(o.price); }).join(" | "));
  if (pinSpread) oddsLines.push("Spread: " + pinSpread.outcomes.map(function(o){ return o.name + " " + (o.point>0?"+":"")+o.point + " @ " + fmtOdds(o.price); }).join(" | "));
  if (pinTotal) oddsLines.push("Total: " + pinTotal.outcomes.map(function(o){ return o.name + " " + o.point + " @ " + fmtOdds(o.price); }).join(" | "));

  var fairLines = fairPrices.map(function(o){ return o.name + " true prob: " + o.trueProb.toFixed(1) + "% | fair odds: " + o.fairOdds; }).join("\n");

  var newsCtx = contextNews ? "\n\nINJURY/LINEUP INTELLIGENCE:\n" + contextNews : "";

  var prompt = "You are a sharp professional sports betting analyst for Australian markets. You explain EDGE, not predictions.\n\nGAME: " + g.away_team + " @ " + g.home_team + "\nSPORT: " + sport + "\nDATE: " + new Date(g.commence_time).toLocaleDateString("en-AU") + "\n\nPINNACLE ODDS (sharp market):\n" + (oddsLines.join("\n") || "Not available") + "\n\nFAIR PRICE (Pinnacle margin removed):\n" + (fairLines || "Not available") + newsCtx + "\n\nProvide structured edge analysis:\n\nEDGE ASSESSMENT:\n[Which side has market value and why — be specific about the price discrepancy]\n\nKEY FACTORS:\n- [Factor 1 — injury/form/matchup]\n- [Factor 2 — line movement/sharp action]\n- [Factor 3 — situational]\n\nMARKET INTELLIGENCE:\n[Has the line moved? Steam? Reverse line movement? Stale soft book prices?]\n\nRECOMMENDED POSITION:\n[Specific bet: side, market, book, decimal odds target]\n\nEV ESTIMATE:\n[Based on fair price vs available book price]\n\nRISK FACTORS:\n[What could make this bet wrong]\n\nCLV PROJECTION:\n[Will the line move in your favour before close?]\n\nMULTI VIABILITY:\n[Is this a clean multi leg or correlated risk?]\n\nVERDICT:\n[One sentence. Price-based. No emotion.]";

  fetch("/api/analyse", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({model:"claude-sonnet-4-20250514", max_tokens:1200, messages:[{role:"user",content:prompt}]})
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    var text = "No analysis returned";
    if (d.content) {
      for (var i=0; i<d.content.length; i++) {
        if (d.content[i].type === "text") { text = d.content[i].text; break; }
      }
    }
    if (d.error) text = "API Error: " + (d.error.message || JSON.stringify(d.error));
    S.aRes[gameId] = text;
    renderPage();
  })
  .catch(function(e) {
    S.aRes[gameId] = "Error: " + e.message;
    renderPage();
  });
}

// ── Value Bet Detection ───────────────────────────────────────
function findValueBets(games) {
  var valueBets = [];
  (games||[]).forEach(function(g) {
    var pin = (g.bookmakers||[]).find(function(b){ return b.key === "pinnacle"; });
    if (!pin) return;
    var gt = new Date(g.commence_time);
    var hoursToGame = (gt - Date.now()) / 3600000;
    if (hoursToGame < 0) return;

    ["h2h","spreads","totals"].forEach(function(mkey) {
      var pinMkt = (pin.markets||[]).find(function(m){ return m.key === mkey; });
      if (!pinMkt) return;
      var fair = stripMargin(pinMkt.outcomes);

      (g.bookmakers||[]).forEach(function(bm) {
        if (bm.key === "pinnacle") return;
        var bmMkt = (bm.markets||[]).find(function(m){ return m.key === mkey; });
        if (!bmMkt) return;

        fair.forEach(function(fo, idx) {
          var bmOutcome = bmMkt.outcomes[idx];
          if (!bmOutcome) return;
          var ev = calcEV(bmOutcome.price, fo.trueProb);
          if (ev > 0.02) {
            var stake = kellyStake(fo.trueProb, bmOutcome.price, S.kf);
            valueBets.push({
              game: g.away_team + " @ " + g.home_team,
              gameId: g.id,
              sport: g.sport || "?",
              pick: fo.name + (fo.point ? " " + (fo.point>0?"+":"")+fo.point : "") + (mkey==="totals"?" "+fo.point:""),
              market: mkey,
              book: bm.key,
              bookOdds: bmOutcome.price,
              fairOdds: fo.fairOdds,
              trueProb: fo.trueProb,
              ev: ev,
              stakeUnits: parseFloat((stake/100).toFixed(3)),
              stakeDollars: parseFloat((S.bankroll * stake / 100).toFixed(2)),
              confidence: confidenceLabel(ev),
              hoursToGame: hoursToGame,
              commence: g.commence_time
            });
          }
        });
      });
    });
  });
  valueBets.sort(function(a,b){ return b.ev - a.ev; });
  return valueBets;
}

// ── Helpers ───────────────────────────────────────────────────
function mc(label, value, color) {
  return '<div class="card" style="text-align:center;padding:12px"><div class="sec-title" style="color:#374151">' + label + '</div><div style="font-size:18px;font-weight:900;color:' + color + '">' + value + '</div></div>';
}

function metricCard(label, value, sub, color, accent) {
  return '<div class="card" style="position:relative;overflow:hidden;border-color:' + (accent||color) + '33">'
    + '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,' + color + ',transparent)"></div>'
    + '<div class="sec-title" style="color:#374151">' + label + '</div>'
    + '<div style="font-size:24px;font-weight:900;color:' + color + ';line-height:1.1">' + value + '</div>'
    + (sub ? '<div style="font-size:10px;color:#4A5568;margin-top:3px">' + sub + '</div>' : '')
    + '</div>';
}

function progBar(label, val, threshold, max, color) {
  var c = color || (val >= threshold ? "#4ECDC4" : "#FF4757");
  return '<div style="margin-bottom:10px">'
    + '<div style="display:flex;justify-content:space-between;font-size:10px;color:#4A5568;margin-bottom:4px">'
    + '<span>' + label + '</span><span style="color:' + c + '">' + val.toFixed(1) + '%</span></div>'
    + '<div class="prog-wrap"><div class="prog-fill" style="width:' + Math.min(val/max*100,100) + '%;background:' + c + '"></div></div>'
    + '</div>';
}

function bookSelect(id) {
  return '<select id="' + id + '">' + BOOKS.map(function(b){ return '<option value="' + b.k + '">' + b.l + '</option>'; }).join("") + '</select>';
}

function sportSelect(id, val) {
  return '<select id="' + id + '">' + SPORTS.map(function(s){ return '<option value="' + s + '"' + (s===val?" selected":"") + '>' + s + '</option>'; }).join("") + '</select>';
}

function betResultColor(r) { return r==="W"?"#4ECDC4":r==="L"?"#FF4757":"#F0A500"; }

function timeTo(commence) {
  var diff = new Date(commence) - Date.now();
  if (diff < 0) return "LIVE";
  var h = Math.floor(diff/3600000);
  var m = Math.floor((diff%3600000)/60000);
  if (h > 48) return Math.floor(h/24) + "d";
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
}

function setBankroll(val) {
  S.bankroll = parseFloat(val) || 0;
  uBar();
}

// ── Status Bar ────────────────────────────────────────────────
function uBar() {
  var st = globalStats();
  function q(id) { return document.getElementById(id); }
  if (!q("b-clv")) return;
  q("b-clv").textContent = "CLV " + fmtPct(st.avgCLV);
  q("b-clv").style.color = st.avgCLV >= 0 ? "#4ECDC4" : "#FF4757";
  q("b-ev").textContent = "EV " + fmtPct(st.avgEV*100);
  q("b-ev").style.color = st.avgEV >= 0 ? "#4ECDC4" : "#FF4757";
  q("b-conf").textContent = "CONF " + st.conf + "%";
  q("b-bk").textContent = "BK $" + S.bankroll.toFixed(0);
  q("b-lim").textContent = S.limits.length + " LIMITED";
  q("b-lim").style.color = S.limits.length ? "#FF4757" : "#374151";
}

// ── Tab Renderer ──────────────────────────────────────────────
function renderTabs() {
  var h = "";
  TABS.forEach(function(t) {
    h += '<button class="tab' + (S.tab===t.id?" on":"") + '" onclick="goTab(\'' + t.id + '\')">' + t.label + '</button>';
  });
  document.getElementById("tabs").innerHTML = h;
}

function goTab(id) {
  S.tab = id;
  renderTabs();
  renderPage();
  if (id === "value" && !S.odds[S.vSport]) loadValueBets(S.vSport);
  if (id === "upnext") loadUpNext();
  if (id === "analysis" && S.aOdds.length === 0) loadAnalysis(S.aSport);
  if (id === "odds" && !S.odds[S.oSport]) { document.getElementById("pg").innerHTML = '<div style="text-align:center;padding:50px;color:#374151">Loading ' + S.oSport + ' odds...</div>'; fetchOdds(S.oSport, function(){ renderPage(); }); }
}

function loadValueBets(sport) {
  S.vSport = sport;
  document.getElementById("pg").innerHTML = '<div style="text-align:center;padding:50px;color:#374151">Finding value bets in ' + sport + '...</div>';
  fetchOdds(sport, function(games) {
    games.forEach(function(g){ g.sport = sport; });
    renderPage();
  });
}

function loadUpNext() {
  document.getElementById("pg").innerHTML = '<div style="text-align:center;padding:50px;color:#374151">Loading upcoming games...</div>';
  var loaded = 0;
  var total = SPORTS.length;
  SPORTS.forEach(function(sp) {
    if (S.odds[sp]) { loaded++; if (loaded === total) renderPage(); return; }
    fetchOdds(sp, function(games) {
      games.forEach(function(g){ g.sport = sp; });
      loaded++;
      if (loaded === total) renderPage();
    });
  });
}

function loadAnalysis(sport) {
  S.aSport = sport;
  S.aOdds = [];
  document.getElementById("pg").innerHTML = '<div style="text-align:center;padding:50px;color:#374151">Loading ' + sport + ' games...</div>';
  fetchOdds(sport, function(games) {
    S.aOdds = games;
    renderPage();
  });
}

// ═══════════════════════════════════════════════════════════
//  PAGE RENDERS
// ═══════════════════════════════════════════════════════════

function renderPage() {
  var pg = document.getElementById("pg");
  var st = globalStats();
  var t = S.tab;

  // ── Streak warning
  if (st.streak >= 5) {
    var sw = '<div class="warn">&#9888; LOSING STREAK ALERT: ' + st.streak + ' consecutive losses. Review your CLV before continuing. Do not chase losses.</div>';
  } else { var sw = ""; }

  // ─────────────────────────────────────────────────────────
  if (t === "dashboard") {
    // Bankroll sparkline
    var bh = [S.bankroll];
    var sorted = st.s.slice().sort(function(a,b){ return new Date(a.date)-new Date(b.date); });
    sorted.forEach(function(b) {
      var l = bh[bh.length-1];
      bh.push(b.result==="W" ? l+b.stake*(b.betOdds-1) : b.result==="L" ? l-b.stake : l);
    });
    var mn=Math.min.apply(null,bh), mx=Math.max.apply(null,bh), rng=mx-mn||1;
    var pts = bh.map(function(v,i){ return ((i/(bh.length-1||1))*200)+","+(40-((v-mn)/rng)*40); }).join(" ");
    var sparkCol = st.profit >= 0 ? "#4ECDC4" : "#FF4757";

    // Hero metrics in correct priority order
    var h = sw;
    h += '<div class="g2" style="margin-bottom:10px">';
    h += metricCard("POSITIVE CLV RATE", st.clvPos.toFixed(1)+"%", st.total+" settled bets", st.clvPos>=50?"#4ECDC4":"#FF4757");
    h += metricCard("AVG EV PER BET", fmtPct(st.avgEV*100), "expected value", st.avgEV>=0?"#4ECDC4":"#FF4757");
    h += '</div>';
    h += '<div class="g2" style="margin-bottom:10px">';
    h += metricCard("SAMPLE CONFIDENCE", st.conf+"%", "need 500+ bets for full confidence", st.conf>=70?"#4ECDC4":"#F0A500");
    h += metricCard("EDGE HEALTH", st.avgCLV>=0?"POSITIVE":"NEGATIVE", "avg CLV " + fmtPct(st.avgCLV), st.avgCLV>=0?"#4ECDC4":"#FF4757");
    h += '</div>';
    h += '<div class="g3" style="margin-bottom:10px">';
    h += metricCard("ACCOUNT HEALTH", S.limits.length===0?"CLEAN":S.limits.length+" LIMITED", "bookmaker status", S.limits.length===0?"#4ECDC4":"#FF4757");
    h += metricCard("EV REALISATION", (st.profit>=0?"+":"")+"$"+st.profit.toFixed(0), (st.profit/(S.bankroll*0.0275)||0).toFixed(1)+" units", st.profit>=0?"#FF6B35":"#FF4757");
    h += metricCard("EDGE EXECUTION RATE", st.wr.toFixed(1)+"%", st.w+"W "+(st.total-st.w)+"L", st.wr>=52.4?"#4ECDC4":"#FF4757");
    h += '</div>';

    // Edge health bars
    h += '<div class="card card-orange" style="margin-bottom:10px">';
    h += '<div class="sec-title" style="color:#FF6B35">EDGE HEALTH DASHBOARD</div>';
    h += progBar("Positive CLV Rate (target 50%+)", st.clvPos, 50, 100);
    h += progBar("Edge Execution Rate (breakeven 52.4%)", st.wr, 52.4, 70);
    h += progBar("Sample Confidence (target 500 bets)", Math.min(st.total/5,100), 50, 100);
    h += progBar("EV Consistency", Math.min(Math.max(st.avgEV*100*10+50,0),100), 50, 100, st.avgEV>=0?"#4ECDC4":"#FF4757");
    h += '</div>';

    // Bankroll chart
    h += '<div class="card" style="margin-bottom:10px">';
    h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="sec-title" style="color:#374151">BANKROLL TRAJECTORY</span><span style="font-size:10px;color:' + sparkCol + '">' + (st.profit>=0?"+":"") + "$"+st.profit.toFixed(0) + '</span></div>';
    h += '<svg viewBox="0 0 200 40" style="width:100%;height:50px" preserveAspectRatio="none">';
    h += '<polyline points="' + pts + '" fill="none" stroke="' + sparkCol + '" stroke-width="1.5" stroke-linejoin="round"/>';
    h += '<polyline points="0,40 ' + pts + ' 200,40" fill="' + sparkCol + '12" stroke="none"/>';
    h += '</svg></div>';

    // Recent positions
    h += '<div class="card" style="padding:14px">';
    h += '<div class="sec-title" style="color:#374151;margin-bottom:8px">RECENT POSITIONS</div>';
    if (S.bets.length === 0) {
      h += '<div style="color:#374151;font-size:11px;text-align:center;padding:20px">No bets logged yet. Start recording your positions in the Tracker tab.</div>';
    } else {
      S.bets.slice(-5).reverse().forEach(function(b) {
        var clv = calcCLV(b.betOdds, b.closingOdds);
        var rc = betResultColor(b.result);
        h += '<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03);gap:8px">';
        h += '<div style="width:4px;height:4px;border-radius:50%;background:' + rc + ';flex-shrink:0"></div>';
        h += '<span style="font-size:9px;color:' + (SC[b.sport]||"#FF6B35") + ';width:32px;flex-shrink:0">' + b.sport + '</span>';
        h += '<span style="flex:1;font-size:11px;color:#9CA3AF;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + b.pick + '</span>';
        h += '<span style="font-size:9px;color:#374151">' + bookLabel(b.bk) + '</span>';
        h += '<span style="font-size:10px;color:' + (clv>=0?"#4ECDC4":"#FF4757") + ';margin-left:8px">' + fmtPct(clv) + ' CLV</span>';
        h += '<span style="font-size:11px;font-weight:700;color:' + rc + ';width:14px;text-align:center;margin-left:6px">' + b.result + '</span>';
        h += '</div>';
      });
    }
    h += '</div>';
    pg.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "value") {
    var allGames = S.odds[S.vSport] || [];
    allGames.forEach(function(g){ g.sport = S.vSport; });
    var vbets = findValueBets(allGames);

    var h = sw;
    // Sport selector
    h += '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">';
    SPORTS.forEach(function(sp) {
      var a = S.vSport === sp;
      h += '<button class="btn ' + (a?"btn-o":"") + '" style="' + (!a?"border:1px solid rgba(255,255,255,.07);color:#374151":"") + '" onclick="loadValueBets(\'' + sp + '\')">' + sp + '</button>';
    });
    h += '<button class="btn btn-t" style="margin-left:auto" onclick="loadValueBets(S.vSport)">REFRESH</button>';
    h += '</div>';

    h += '<div class="info">Value Bets are calculated by stripping Pinnacle\'s margin to find the true probability, then comparing against soft book prices. Only bets with positive EV are shown.</div>';

    if (!S.odds[S.vSport]) {
      h += '<div style="text-align:center;padding:40px;color:#374151">Loading...</div>';
    } else if (vbets.length === 0) {
      h += '<div style="text-align:center;padding:40px;color:#374151">No positive EV bets found in current ' + S.vSport + ' markets. Check back closer to game time or try another sport.</div>';
    } else {
      vbets.forEach(function(vb) {
        var evPct = (vb.ev * 100).toFixed(1);
        var cc = confidenceColor(vb.ev);
        h += '<div class="card vbet vbet-' + vb.confidence.toLowerCase() + '" style="margin-bottom:10px">';
        h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">';
        h += '<div><div style="font-size:9px;color:' + (SC[vb.sport]||"#FF6B35") + ';margin-bottom:3px">' + vb.sport + ' &middot; ' + timeTo(vb.commence) + ' to game</div>';
        h += '<div style="font-size:13px;font-weight:700">' + vb.pick + '</div>';
        h += '<div style="font-size:10px;color:#4A5568">' + vb.game + '</div></div>';
        h += '<div class="tag" style="color:' + cc + ';background:' + cc + '18;border:1px solid ' + cc + '44">' + vb.confidence + '</div>';
        h += '</div>';
        h += '<div class="g3" style="margin-bottom:10px">';
        h += mc("BOOK ODDS", fmtOdds(vb.bookOdds), "#E8EAF0");
        h += mc("FAIR ODDS", fmtOdds(vb.fairOdds), "#4ECDC4");
        h += mc("EV", "+" + evPct + "%", "#4ECDC4");
        h += '</div>';
        h += '<div style="display:flex;justify-content:space-between;align-items:center">';
        h += '<div style="font-size:10px;color:#4A5568">Book: <span style="color:' + bookColor(vb.book) + '">' + bookLabel(vb.book) + '</span> &nbsp; Stake: <span style="color:#FF6B35">$' + vb.stakeDollars.toFixed(2) + '</span> (' + (vb.stakeUnits*100).toFixed(1) + '% bankroll)</div>';
        h += '<button class="btn btn-o" onclick="prefillBet(' + JSON.stringify(vb).replace(/"/g,"'") + ')">LOG POSITION</button>';
        h += '</div></div>';
      });
    }
    pg.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "upnext") {
    var allUpcoming = [];
    SPORTS.forEach(function(sp) {
      (S.odds[sp]||[]).forEach(function(g) {
        if (new Date(g.commence_time) > Date.now()) {
          g.sport = sp;
          allUpcoming.push(g);
        }
      });
    });
    allUpcoming.sort(function(a,b){ return new Date(a.commence_time)-new Date(b.commence_time); });

    var h = sw;
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
    h += '<div style="font-size:9px;color:#374151;letter-spacing:2px">NEXT 48 HOURS &middot; ALL SPORTS</div>';
    h += '<button class="btn btn-t" onclick="loadUpNext()">REFRESH</button>';
    h += '</div>';
    h += '<div class="info">Games sorted by kick-off time. Book disparity flag shows when soft books are significantly off Pinnacle\'s line.</div>';

    if (allUpcoming.length === 0) {
      h += '<div style="text-align:center;padding:40px;color:#374151">Loading upcoming games across all sports...</div>';
    } else {
      var shown = 0;
      allUpcoming.slice(0,30).forEach(function(g) {
        var gt = new Date(g.commence_time);
        var hours = (gt - Date.now())/3600000;
        if (hours > 48) return;
        shown++;

        // Find best disparity
        var pin = (g.bookmakers||[]).find(function(b){ return b.key==="pinnacle"; });
        var pinH2H = pin ? (pin.markets||[]).find(function(m){ return m.key==="h2h"; }) : null;
        var pinPrice = pinH2H ? pinH2H.outcomes[0].price : null;
        var maxSoftPrice = 0;
        var maxSoftBook = "";
        (g.bookmakers||[]).forEach(function(bm) {
          if (bm.key==="pinnacle") return;
          var m = (bm.markets||[]).find(function(x){ return x.key==="h2h"; });
          if (m && m.outcomes[0] && m.outcomes[0].price > maxSoftPrice) {
            maxSoftPrice = m.outcomes[0].price;
            maxSoftBook = bm.key;
          }
        });
        var disparity = pinPrice && maxSoftPrice ? ((maxSoftPrice/pinPrice - 1)*100).toFixed(1) : null;
        var hasEdge = disparity && parseFloat(disparity) > 3;

        h += '<div class="card' + (hasEdge?" card-teal":"") + '" style="margin-bottom:8px">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center">';
        h += '<div>';
        h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:3px">';
        h += '<span class="tag" style="color:' + (SC[g.sport]||"#FF6B35") + ';background:' + (SC[g.sport]||"#FF6B35") + '18">' + g.sport + '</span>';
        h += '<span style="font-size:9px;color:#374151">' + gt.toLocaleDateString("en-AU") + ' ' + gt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) + '</span>';
        h += '<span style="font-size:9px;color:#4ECDC4">' + timeTo(g.commence_time) + '</span>';
        h += '</div>';
        h += '<div style="font-size:12px;font-weight:700">' + g.away_team + '</div>';
        h += '<div style="font-size:10px;color:#4A5568">@ ' + g.home_team + '</div>';
        h += '</div>';
        h += '<div style="text-align:right">';
        if (pinPrice) h += '<div style="font-size:11px;color:#4ECDC4">PIN ' + fmtOdds(pinPrice) + '</div>';
        if (hasEdge) h += '<div style="font-size:9px;color:#4ECDC4;margin-top:2px">DISPARITY +' + disparity + '%</div>';
        if (maxSoftBook) h += '<div style="font-size:9px;color:' + bookColor(maxSoftBook) + '">' + bookLabel(maxSoftBook) + ' ' + fmtOdds(maxSoftPrice) + '</div>';
        h += '</div></div></div>';
      });
      if (shown === 0) h += '<div style="text-align:center;padding:40px;color:#374151">No games in next 48 hours. Refresh to check.</div>';
    }
    pg.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "tracker") {
    var h = sw;
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
    h += '<div style="font-size:9px;color:#374151;letter-spacing:2px">' + S.bets.length + ' POSITIONS RECORDED</div>';
    h += '<button class="btn btn-o" onclick="toggleEl(\'abf\')">+ RECORD POSITION</button>';
    h += '</div>';

    h += '<div id="abf" class="hidden card card-orange" style="margin-bottom:12px">';
    h += '<div class="sec-title" style="color:#FF6B35;margin-bottom:10px">NEW POSITION</div>';
    h += '<div class="g2">';
    h += '<div><label class="lbl">DATE</label><input type="date" id="nb-date"></div>';
    h += '<div><label class="lbl">SPORT</label>' + sportSelect("nb-sport","AFL") + '</div>';
    h += '<div><label class="lbl">GAME</label><input type="text" id="nb-game" placeholder="Team A vs Team B"></div>';
    h += '<div><label class="lbl">PICK / MARKET</label><input type="text" id="nb-pick" placeholder="e.g. Team A -3.5"></div>';
    h += '<div><label class="lbl">BET ODDS (DECIMAL)</label><input type="number" id="nb-betOdds" value="2.00" step="0.01"></div>';
    h += '<div><label class="lbl">CLOSING ODDS (DECIMAL)</label><input type="number" id="nb-closingOdds" value="2.00" step="0.01"></div>';
    h += '<div><label class="lbl">BOOKMAKER</label>' + bookSelect("nb-bk") + '</div>';
    h += '<div><label class="lbl">RESULT</label><select id="nb-result"><option value="P">Pending</option><option value="W">Win</option><option value="L">Loss</option></select></div>';
    h += '<div><label class="lbl">TRUE PROB % (for EV)</label><input type="number" id="nb-prob" value="52" step="0.1"></div>';
    h += '<div><label class="lbl">STAKE ($)</label><input type="number" id="nb-stake" value="' + (S.bankroll*S.kf*0.05).toFixed(2) + '" step="0.01"></div>';
    h += '</div>';
    h += '<div style="margin-top:8px;padding:8px 10px;background:rgba(78,205,196,.05);border-radius:6px;font-size:11px;color:#4ECDC4" id="kelly-preview">Enter odds and probability to see Kelly recommendation</div>';
    h += '<button class="btn btn-prim" onclick="addBet()">RECORD POSITION</button>';
    h += '</div>';

    var rbets = S.bets.slice().reverse();
    if (rbets.length === 0) {
      h += '<div style="text-align:center;padding:40px;color:#374151;font-size:11px">No positions recorded yet.<br>Start logging your bets to track CLV and EV.</div>';
    }
    rbets.forEach(function(b) {
      var clv = calcCLV(b.betOdds, b.closingOdds);
      var pnl = b.result==="W" ? b.stake*(b.betOdds-1) : b.result==="L" ? -b.stake : 0;
      var li = S.limits.find(function(l){ return l.bk===b.bk; });
      var rc = betResultColor(b.result);
      h += '<div class="card bet-' + b.result.toLowerCase() + '" style="margin-bottom:8px">';
      h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px">';
      h += '<div>';
      h += '<div style="display:flex;gap:6px;margin-bottom:3px;flex-wrap:wrap">';
      h += '<span style="font-size:9px;color:' + (SC[b.sport]||"#FF6B35") + '">' + b.sport + '</span>';
      h += '<span style="font-size:9px;color:#374151">' + b.date + '</span>';
      h += '<span style="font-size:9px;color:' + bookColor(b.bk) + '">' + bookLabel(b.bk) + '</span>';
      if (li) h += '<span class="tag" style="color:#FF4757;background:rgba(255,71,87,.1)">LIMITED $' + li.curr + '</span>';
      h += '</div>';
      h += '<div style="font-size:13px;font-weight:600">' + b.pick + '</div>';
      h += '<div style="font-size:10px;color:#4A5568">' + b.game + '</div>';
      h += '</div>';
      h += '<div style="text-align:right;flex-shrink:0">';
      h += '<div style="font-size:15px;font-weight:900;color:' + rc + '">' + (b.result==="P"?"PENDING":(pnl>=0?"+":"")+"$"+pnl.toFixed(2)) + '</div>';
      h += '<div style="font-size:9px;color:#374151">stake $' + b.stake.toFixed(2) + '</div>';
      h += '</div></div>';
      h += '<div style="display:flex;gap:14px;font-size:10px">';
      h += '<span style="color:#4A5568">Odds <span style="color:#E8EAF0">' + fmtOdds(b.betOdds) + '</span></span>';
      h += '<span style="color:#4A5568">Close <span style="color:#E8EAF0">' + fmtOdds(b.closingOdds) + '</span></span>';
      h += '<span style="color:' + (clv>=0?"#4ECDC4":"#FF4757") + '">CLV ' + fmtPct(clv) + '</span>';
      if (b.ev) h += '<span style="color:' + (b.ev>=0?"#4ECDC4":"#FF4757") + '">EV ' + fmtPct(b.ev*100) + '</span>';
      h += '</div></div>';
    });
    pg.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "pending") {
    var pending = S.bets.filter(function(b){ return b.result === "P"; });
    var h = sw;
    h += '<div style="font-size:9px;color:#374151;letter-spacing:2px;margin-bottom:10px">' + pending.length + ' OPEN POSITIONS</div>';

    if (pending.length === 0) {
      h += '<div style="text-align:center;padding:40px;color:#374151;font-size:11px">No pending positions.<br>Bets logged as Pending will appear here with live CLV tracking.</div>';
    } else {
      pending.forEach(function(b) {
        var currentPin = null;
        var sport = b.sport;
        if (S.odds[sport]) {
          var game = (S.odds[sport]||[]).find(function(g){ return g.id === b.gameId; });
          if (game) {
            var pin = (game.bookmakers||[]).find(function(bm){ return bm.key==="pinnacle"; });
            var pinH2H = pin ? (pin.markets||[]).find(function(m){ return m.key==="h2h"; }) : null;
            if (pinH2H) currentPin = pinH2H.outcomes[0].price;
          }
        }
        var clvNow = currentPin ? calcCLV(b.betOdds, currentPin) : null;
        var li = S.limits.find(function(l){ return l.bk===b.bk; });

        h += '<div class="card bet-p" style="margin-bottom:10px">';
        h += '<div style="display:flex;justify-content:space-between;margin-bottom:8px">';
        h += '<div>';
        h += '<div style="display:flex;gap:6px;margin-bottom:3px;flex-wrap:wrap">';
        h += '<span style="font-size:9px;color:' + (SC[b.sport]||"#FF6B35") + '">' + b.sport + '</span>';
        h += '<span style="font-size:9px;color:#374151">' + b.date + '</span>';
        h += '<span style="font-size:9px;color:' + bookColor(b.bk) + '">' + bookLabel(b.bk) + '</span>';
        if (li) h += '<span class="tag" style="color:#FF4757;background:rgba(255,71,87,.1)">LIMITED</span>';
        h += '</div>';
        h += '<div style="font-size:13px;font-weight:600">' + b.pick + '</div>';
        h += '<div style="font-size:10px;color:#4A5568">' + b.game + '</div>';
        h += '</div>';
        h += '<div style="text-align:right">';
        h += '<div style="font-size:14px;font-weight:900;color:#F0A500">OPEN</div>';
        h += '<div style="font-size:9px;color:#374151">$' + b.stake.toFixed(2) + ' at stake</div>';
        h += '</div></div>';

        h += '<div class="g3">';
        h += mc("BET ODDS", fmtOdds(b.betOdds), "#E8EAF0");
        h += mc("CURRENT PIN", currentPin ? fmtOdds(currentPin) : "—", "#4ECDC4");
        h += mc("CLV NOW", clvNow !== null ? fmtPct(clvNow) : "—", clvNow !== null ? (clvNow>=0?"#4ECDC4":"#FF4757") : "#374151");
        h += '</div>';

        h += '<div style="display:flex;gap:8px;margin-top:10px">';
        h += '<button class="btn btn-t" onclick="settleBet(' + b.id + ',\'W\')">MARK WIN</button>';
        h += '<button class="btn btn-r" onclick="settleBet(' + b.id + ',\'L\')">MARK LOSS</button>';
        h += '</div></div>';
      });
    }
    pg.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "analysis") {
    var h = sw;
    h += '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">';
    SPORTS.forEach(function(sp) {
      var a = S.aSport === sp;
      h += '<button class="btn ' + (a?"btn-o":"") + '" style="' + (!a?"border:1px solid rgba(255,255,255,.07);color:#374151":"") + '" onclick="loadAnalysis(\'' + sp + '\')">' + sp + '</button>';
    });
    h += '<button class="btn btn-t" style="margin-left:auto" onclick="loadAnalysis(S.aSport)">REFRESH</button>';
    h += '</div>';
    h += '<div class="info">Market Intelligence Engine: Claude analyses edge using Pinnacle fair price, line movement and team intelligence. No predictions — only price-based edge explanation.</div>';

    if (S.aOdds.length === 0) {
      h += '<div style="text-align:center;padding:40px;color:#374151">Select a sport and hit REFRESH.</div>';
    }
    S.aOdds.forEach(function(g) {
      var gt = new Date(g.commence_time);
      var pin = (g.bookmakers||[]).find(function(b){ return b.key==="pinnacle"; });
      var pinH2H = pin ? (pin.markets||[]).find(function(m){ return m.key==="h2h"; }) : null;
      var fair = pinH2H ? stripMargin(pinH2H.outcomes) : [];
      var res = S.aRes[g.id];
      var loading = res === "LOADING";

      h += '<div class="card" style="margin-bottom:12px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">';
      h += '<div>';
      h += '<div style="font-size:9px;color:#374151;margin-bottom:3px">' + gt.toLocaleDateString("en-AU") + ' ' + gt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) + ' &middot; ' + timeTo(g.commence_time) + '</div>';
      h += '<div style="font-size:14px;font-weight:700">' + g.away_team + '</div>';
      h += '<div style="font-size:11px;color:#4A5568">@ ' + g.home_team + '</div>';

      if (fair.length > 0) {
        h += '<div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap">';
        fair.forEach(function(fo) {
          h += '<span style="font-size:10px;color:#4ECDC4">' + fo.name + ': <strong>' + fmtOdds(fo.fairOdds) + '</strong> (' + fo.trueProb.toFixed(1) + '%)</span>';
        });
        h += '<span style="font-size:9px;color:#374151">&middot; Pinnacle fair price</span>';
        h += '</div>';
      }
      h += '</div>';
      h += '<button class="btn btn-o" ' + (loading?"disabled":"") + ' onclick="runAnalysis(\'' + g.id + '\',\'' + S.aSport + '\',null)">' + (loading?"ANALYSING...":"FIND EDGE") + '</button>';
      h += '</div>';

      if (res && res !== "LOADING") {
        h += '<div class="card card-orange" style="margin-top:0">';
        h += '<div class="sec-title" style="color:#FF6B35;margin-bottom:10px">MARKET INTELLIGENCE &middot; EDGE//STACK AI</div>';
        h += '<div style="font-size:12px;color:#D1D5DB;line-height:1.9;white-space:pre-wrap">' + res + '</div>';
        h += '<button class="btn btn-o" style="margin-top:10px" onclick="goTab(\'tracker\')">RECORD POSITION</button>';
        h += '</div>';
      }
      h += '</div>';
    });
    pg.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "multi") {
    var mc2 = calcMulti();
    var flags = correlationFlag(S.legs);

    var h = sw;
    h += '<div class="info">Multi EV Builder: Uses Pinnacle-derived fair price for each leg. Most multis are negative EV. A rejection is the correct answer most of the time.</div>';

    S.legs.forEach(function(leg, i) {
      var le = leg.wp - d2i(leg.odds);
      var ec = le > 0 ? "#4ECDC4" : "#FF4757";
      h += '<div class="card" style="margin-bottom:10px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
      h += '<div class="sec-title" style="color:#FF6B35">LEG ' + (i+1) + '</div>';
      if (S.legs.length > 2) h += '<button class="btn btn-r" style="padding:3px 8px;font-size:9px" onclick="removeLeg(' + leg.id + ')">REMOVE</button>';
      h += '</div>';
      h += '<div class="g3">';
      h += '<div style="grid-column:1/-1"><label class="lbl">PICK</label><input type="text" value="' + leg.pick + '" placeholder="e.g. Collingwood -9.5" onchange="updateLeg(' + leg.id + ',\'pick\',this.value)"></div>';
      h += '<div><label class="lbl">SPORT</label>' + sportSelect("leg-sp-"+leg.id, leg.sport) + '<script>document.getElementById("leg-sp-'+leg.id+'").onchange=function(){updateLeg('+leg.id+',\'sport\',this.value)}<\/script></div>';
      h += '<div><label class="lbl">BOOK ODDS (DEC)</label><input type="number" value="' + leg.odds + '" step="0.01" style="text-align:center;font-size:14px;font-weight:700" onchange="updateLeg(' + leg.id + ',\'odds\',parseFloat(this.value)||2)"></div>';
      h += '<div><label class="lbl">WIN PROB %</label><input type="number" value="' + leg.wp + '" step="0.1" style="text-align:center;font-size:14px;font-weight:700" onchange="updateLeg(' + leg.id + ',\'wp\',parseFloat(this.value)||50)"></div>';
      h += '<div><label class="lbl">LEG EV</label><div style="padding:8px;background:rgba(255,255,255,.03);border-radius:6px;text-align:center;font-size:13px;font-weight:700;color:' + ec + '">' + (le>=0?"+":"") + le.toFixed(2) + '%</div></div>';
      h += '</div></div>';
    });

    h += '<button class="btn btn-t" style="width:100%;padding:10px;text-align:center;margin-bottom:10px" onclick="addLeg()">+ ADD LEG</button>';

    if (flags.length > 0) {
      h += '<div class="warn" style="margin-bottom:10px">';
      h += '<div style="font-weight:700;margin-bottom:4px">CORRELATION WARNING</div>';
      flags.forEach(function(f){ h += '<div style="margin-top:2px">&middot; ' + f + '</div>'; });
      h += '</div>';
    }

    if (mc2) {
      var mclr = mc2.ev > 0 ? "#4ECDC4" : "#FF4757";
      var verdict = mc2.ev > 0
        ? "APPROVED: Positive EV " + mc2.n + "-leg multi. Max stake $" + (S.bankroll*0.01).toFixed(2) + " (1% bankroll — multis are high variance)."
        : "REJECTED: " + (mc2.allPos ? "Combined vig destroys individual edge." : "One or more legs have no edge. Fix individual legs first.") + " Do not place this multi.";

      h += '<div class="card" style="border-color:' + mclr + '33;background:' + mclr + '08">';
      h += '<div class="sec-title" style="color:' + mclr + ';margin-bottom:12px">' + (mc2.ev>0?"APPROVED — POSITIVE EV":"REJECTED — NEGATIVE EV") + '</div>';
      h += '<div class="g3" style="margin-bottom:12px">';
      h += mc("COMBINED ODDS", fmtOdds(mc2.combinedOdds), "#FF6B35");
      h += mc("WIN PROBABILITY", mc2.prob.toFixed(1)+"%", "#F0A500");
      h += mc("EXPECTED VALUE", (mc2.ev*100>=0?"+":"")+( mc2.ev*100).toFixed(2)+"%", mclr);
      h += '</div>';
      h += '<div style="font-size:11px;line-height:1.7;color:' + mclr + '">' + verdict + '</div>';
      h += '</div>';
    }
    pg.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "kelly") {
    var h = sw;
    h += '<div class="card card-orange" style="margin-bottom:10px">';
    h += '<div class="sec-title" style="color:#FF6B35;margin-bottom:14px">KELLY CRITERION — STAKE SIZING ENGINE</div>';
    h += '<div class="info" style="margin-bottom:12px">Using 25% Kelly (quarter Kelly) — mathematically optimal balance of growth vs risk. Never full Kelly.</div>';
    h += '<div class="g2" style="margin-bottom:14px">';
    h += '<div><label class="lbl">TRUE WIN PROBABILITY %</label><input type="number" id="kw" value="55" step="0.1" style="text-align:center;font-size:17px;font-weight:700;color:#FF6B35" oninput="uKelly()"></div>';
    h += '<div><label class="lbl">BOOK ODDS (DECIMAL)</label><input type="number" id="ko" value="2.00" step="0.01" style="text-align:center;font-size:17px;font-weight:700;color:#FF6B35" oninput="uKelly()"></div>';
    h += '</div>';
    h += '<div style="margin-bottom:14px">';
    h += '<div style="display:flex;justify-content:space-between;font-size:10px;color:#4A5568;margin-bottom:6px"><span>KELLY FRACTION</span><span id="kfl" style="color:#FF6B35">' + (S.kf*100).toFixed(0) + '%</span></div>';
    h += '<input type="range" min="0.1" max="1" step="0.05" value="' + S.kf + '" oninput="S.kf=parseFloat(this.value);var e=document.getElementById(\'kfl\');if(e)e.textContent=(S.kf*100).toFixed(0)+\'%\';uKelly()">';
    h += '</div>';
    h += '<div class="g3" id="kr"></div><div id="kw2"></div>';
    h += '</div>';
    h += '<div class="card card-teal">';
    h += '<div class="sec-title" style="color:#4ECDC4;margin-bottom:12px">GROWTH PROJECTION &middot; 55% WIN RATE &middot; 3 BETS/DAY</div>';
    h += '<div class="g3" id="kp"></div>';
    h += '</div>';
    uKelly();
    pg.innerHTML = h;
    uKelly();
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "clv") {
    var h = sw;
    h += '<div class="card card-teal" style="margin-bottom:10px">';
    h += '<div class="sec-title" style="color:#4ECDC4;margin-bottom:10px">CLV CALCULATOR — PINNACLE BENCHMARK</div>';
    h += '<div class="info" style="margin-bottom:12px">Closing Line Value is the most reliable long-term edge metric. Consistently beating Pinnacle\'s close = verified edge. More important than win rate.</div>';
    h += '<div class="g2" style="margin-bottom:12px">';
    h += '<div><label class="lbl">YOUR BET ODDS (DECIMAL)</label><input type="number" id="cb" value="2.10" step="0.01" style="text-align:center;font-size:17px;font-weight:700;color:#45B7D1" oninput="uCLV()"></div>';
    h += '<div><label class="lbl">PINNACLE CLOSING ODDS</label><input type="number" id="cc" value="1.95" step="0.01" style="text-align:center;font-size:17px;font-weight:700;color:#45B7D1" oninput="uCLV()"></div>';
    h += '</div>';
    h += '<div class="g3" id="clvr" style="margin-bottom:12px"></div>';
    h += '<div id="clvv"></div>';
    h += '</div>';

    h += '<div class="card" style="padding:14px">';
    h += '<div class="sec-title" style="color:#374151;margin-bottom:8px">ALL POSITIONS &middot; AVG CLV <span style="color:' + (st.avgCLV>=0?"#4ECDC4":"#FF4757") + '">' + fmtPct(st.avgCLV) + '</span></div>';
    if (S.bets.length === 0) {
      h += '<div style="color:#374151;font-size:11px;text-align:center;padding:20px">No positions logged yet.</div>';
    }
    S.bets.forEach(function(b) {
      var c2 = calcCLV(b.betOdds, b.closingOdds);
      h += '<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03)">';
      h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px">';
      h += '<div><span style="font-size:9px;color:' + (SC[b.sport]||"#FF6B35") + ';margin-right:8px">' + b.sport + '</span><span style="font-size:11px;color:#9CA3AF">' + b.pick + '</span></div>';
      h += '<span style="font-size:11px;font-weight:700;color:' + (c2>=0?"#4ECDC4":"#FF4757") + '">' + fmtPct(c2) + '</span>';
      h += '</div>';
      h += '<div class="prog-wrap"><div class="prog-fill" style="width:' + Math.min(Math.abs(c2)*10,100) + '%;background:' + (c2>=0?"#4ECDC4":"#FF4757") + '"></div></div>';
      h += '</div>';
    });
    h += '</div>';
    pg.innerHTML = h;
    uCLV();
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "odds") {
    var games = S.odds[S.oSport] || [];
    var h = sw;
    h += '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">';
    SPORTS.forEach(function(sp) {
      var a = S.oSport === sp;
      h += '<button class="btn ' + (a?"btn-o":"") + '" style="' + (!a?"border:1px solid rgba(255,255,255,.07);color:#374151":"") + '" onclick="S.oSport=\'' + sp + '\';S.selGame=null;fetchOdds(\'' + sp + '\',function(){renderPage()});document.getElementById(\'pg\').innerHTML=\'<div style=text-align:center;padding:50px;color:#374151>Loading ' + sp + ' odds...</div>\'">' + sp + '</button>';
    });
    h += '<button class="btn btn-t" style="margin-left:auto" onclick="S.selGame=null;fetchOdds(S.oSport,function(){renderPage()})">REFRESH</button>';
    h += '<span style="font-size:9px;color:#374151">' + (S.remReq?S.remReq+"/500 req":"") + '</span>';
    h += '</div>';

    if (S.oddsErr) h += '<div class="warn">API Error: ' + S.oddsErr + '</div>';
    if (games.length === 0 && !S.oddsErr) h += '<div style="text-align:center;padding:50px;color:#374151">Select a sport and hit REFRESH.</div>';

    games.forEach(function(g) {
      var gt = new Date(g.commence_time);
      var isOpen = S.selGame === g.id;
      var gm = S.mOdds[g.id] || {};

      // Find best H2H
      var allH2H = [];
      (g.bookmakers||[]).forEach(function(bm) {
        var m = (bm.markets||[]).find(function(x){ return x.key==="h2h"; });
        if (m) allH2H = allH2H.concat(m.outcomes||[]);
      });
      var bestP = allH2H.length ? Math.max.apply(null,allH2H.map(function(o){return o.price;})) : null;

      // Fair price
      var pin = (g.bookmakers||[]).find(function(b){ return b.key==="pinnacle"; });
      var pinH2H = pin ? (pin.markets||[]).find(function(m){ return m.key==="h2h"; }) : null;
      var fair = pinH2H ? stripMargin(pinH2H.outcomes) : [];

      h += '<div class="card" style="padding:0;overflow:hidden;margin-bottom:8px;border-color:' + (isOpen?"rgba(255,107,53,.3)":"rgba(255,255,255,.07)") + '">';
      h += '<div onclick="S.selGame=S.selGame===\'' + g.id + '\'?null:\'' + g.id + '\';renderPage()" style="padding:12px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">';
      h += '<div>';
      h += '<div style="font-size:9px;color:#374151;margin-bottom:2px">' + gt.toLocaleDateString("en-AU") + ' ' + gt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) + ' &middot; ' + timeTo(g.commence_time) + '</div>';
      h += '<div style="font-size:13px;font-weight:700">' + g.away_team + '</div>';
      h += '<div style="font-size:10px;color:#4A5568">@ ' + g.home_team + '</div>';
      h += '</div>';
      h += '<div style="text-align:right">';
      if (bestP) h += '<div style="font-size:11px;color:#4ECDC4">Best ' + fmtOdds(bestP) + '</div>';
      if (fair.length) h += '<div style="font-size:9px;color:#374151">Fair ' + fmtOdds(fair[0].fairOdds) + '</div>';
      h += '<div style="font-size:11px;color:#FF6B35;margin-top:2px">' + (isOpen?"▲":"▼") + '</div>';
      h += '</div></div>';

      if (isOpen) {
        h += '<div style="border-top:1px solid rgba(255,255,255,.05);padding:12px 14px">';

        // Manual AU book odds
        h += '<div style="background:rgba(255,107,53,.03);border-radius:8px;padding:10px;margin-bottom:12px">';
        h += '<div class="sec-title" style="color:#FF6B35;margin-bottom:8px">MANUAL AU BOOK ODDS</div>';
        h += '<div class="g4">';
        SOFT_BOOKS.forEach(function(bk) {
          var bi = BOOKS.find(function(x){ return x.k===bk; })||{l:bk};
          var val = gm[bk]||"";
          var pinP = fair.length ? fair[0].fairOdds : null;
          var hasEdge = val && pinP && parseFloat(val) > pinP;
          h += '<div style="background:' + (hasEdge?"rgba(78,205,196,.07)":"rgba(255,255,255,.02)") + ';border:1px solid ' + (hasEdge?"rgba(78,205,196,.25)":"rgba(255,255,255,.05)") + ';border-radius:6px;padding:7px">';
          h += '<div style="font-size:9px;color:#374151;margin-bottom:3px">' + bi.l + '</div>';
          h += '<input type="number" placeholder="2.00" value="' + val + '" step="0.01" style="width:100%;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,.08);color:' + (hasEdge?"#4ECDC4":"#E8EAF0") + ';font-size:12px;font-weight:700;font-family:inherit;outline:none;padding:2px 0;box-sizing:border-box" onchange="setManualOdds(\'' + g.id + '\',\'' + bk + '\',this.value)">';
          if (hasEdge) h += '<div style="font-size:8px;color:#4ECDC4;margin-top:2px">BEATS FAIR PRICE</div>';
          h += '</div>';
        });
        h += '</div></div>';

        // Markets
        ["h2h","spreads","totals"].forEach(function(mkey) {
          var hasMkt = (g.bookmakers||[]).some(function(bm){ return (bm.markets||[]).some(function(m){ return m.key===mkey; }); });
          if (!hasMkt) return;
          var mclrs = {h2h:"#FF6B35",spreads:"#45B7D1",totals:"#F0A500"};
          var mlbls = {h2h:"MONEYLINE",spreads:"SPREAD",totals:"TOTAL"};
          var sides = mkey==="totals" ? ["Over","Under"] : [g.away_team, g.home_team];

          h += '<div style="margin-bottom:12px">';
          h += '<div class="sec-title" style="color:' + mclrs[mkey] + ';margin-bottom:8px">' + mlbls[mkey] + '</div>';
          h += '<div class="g2">';

          sides.forEach(function(side, ti) {
            var bms = [];
            (g.bookmakers||[]).forEach(function(bm) {
              var bmkt = (bm.markets||[]).find(function(m){ return m.key===mkey; });
              if (!bmkt) return;
              var o = mkey==="totals" ? (bmkt.outcomes||[]).find(function(x){ return x.name===side; }) : (bmkt.outcomes||[])[ti];
              if (o) bms.push({key:bm.key, price:o.price, point:o.point});
            });
            var bp = bms.length ? Math.max.apply(null,bms.map(function(x){return x.price;})) : -999;

            h += '<div style="background:rgba(255,255,255,.02);border-radius:8px;padding:10px">';
            h += '<div style="font-size:10px;color:#6B7280;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + side + '</div>';
            h += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
            bms.forEach(function(bm) {
              var ib = bm.price === bp;
              h += '<div style="background:' + (ib?mclrs[mkey]+"18":"rgba(255,255,255,.03)") + ';border:1px solid ' + (ib?mclrs[mkey]+"44":"rgba(255,255,255,.05)") + ';border-radius:6px;padding:5px 7px;text-align:center">';
              h += '<div style="font-size:8px;color:#374151">' + bm.key.replace("_au","").slice(0,4).toUpperCase() + '</div>';
              if (mkey!=="h2h") h += '<div style="font-size:9px;color:#4A5568">' + (bm.point>0?"+":"") + bm.point + '</div>';
              h += '<div style="font-size:12px;font-weight:700;color:' + (ib?mclrs[mkey]:"#E8EAF0") + '">' + fmtOdds(bm.price) + '</div>';
              h += '</div>';
            });
            h += '</div></div>';
          });
          h += '</div></div>';
        });
        h += '<div style="font-size:10px;color:#1F2937;margin-top:4px">Highlighted = best available line. Enter AU book odds above to compare vs fair price.</div>';
        h += '</div>';
      }
      h += '</div>';
    });
    pg.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "books") {
    var h = sw;
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
    h += '<div style="font-size:9px;color:#374151;letter-spacing:2px">ACCOUNT HEALTH MONITOR</div>';
    h += '<button class="btn btn-r" onclick="toggleEl(\'alf\')">+ LOG LIMIT</button>';
    h += '</div>';

    h += '<div id="alf" class="hidden card card-red" style="margin-bottom:12px">';
    h += '<div class="g2">';
    h += '<div><label class="lbl">BOOKMAKER</label>' + bookSelect("nl-bk") + '</div>';
    h += '<div><label class="lbl">DATE</label><input type="date" id="nl-date"></div>';
    h += '<div><label class="lbl">ORIGINAL MAX STAKE $</label><input type="number" id="nl-orig" placeholder="500"></div>';
    h += '<div><label class="lbl">CURRENT MAX STAKE $</label><input type="number" id="nl-curr" placeholder="50"></div>';
    h += '<div style="grid-column:1/-1"><label class="lbl">NOTES</label><input type="text" id="nl-notes" placeholder="Reason for limit..."></div>';
    h += '</div>';
    h += '<button class="btn btn-prim" onclick="addLimit()">LOG LIMIT</button>';
    h += '</div>';

    BOOKS.forEach(function(bk) {
      var bb = st.s.filter(function(b){ return b.bk===bk.k; });
      var bw = bb.filter(function(b){ return b.result==="W"; }).length;
      var bwr = bb.length ? bw/bb.length*100 : 0;
      var bpr = bb.reduce(function(a,b){ return b.result==="W"?a+b.stake*(b.betOdds-1):b.result==="L"?a-b.stake:a; },0);
      var bcv = bb.reduce(function(a,b){ return a+calcCLV(b.betOdds,b.closingOdds); },0)/(bb.length||1);
      var li = S.limits.find(function(l){ return l.bk===bk.k; });
      var risk = bb.length >= 20 && bwr >= 58;

      // Danger score
      var danger = 0;
      if (bwr >= 60) danger += 30;
      else if (bwr >= 55) danger += 15;
      if (bcv >= 3) danger += 30;
      else if (bcv >= 1) danger += 15;
      if (bb.length >= 30) danger += 20;
      if (li) danger += 20;
      var dangerLabel = danger >= 60 ? "HIGH" : danger >= 30 ? "MEDIUM" : "LOW";
      var dangerColor = danger >= 60 ? "#FF4757" : danger >= 30 ? "#F0A500" : "#4ECDC4";

      h += '<div class="card" style="border-color:' + (li?"rgba(255,71,87,.25)":risk?"rgba(240,165,0,.25)":"rgba(255,255,255,.07)") + ';margin-bottom:10px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">';
      h += '<div>';
      h += '<div style="display:flex;gap:7px;align-items:center;margin-bottom:4px">';
      h += '<span style="font-size:13px;font-weight:700;color:' + bk.c + '">' + bk.l + '</span>';
      h += '<span class="tag" style="color:' + bk.c + ';background:' + bk.c + '18">' + bk.t + '</span>';
      if (li) h += '<span class="tag" style="color:#FF4757;background:rgba(255,71,87,.1)">LIMITED</span>';
      if (risk&&!li) h += '<span class="tag" style="color:#F0A500;background:rgba(240,165,0,.1)">AT RISK</span>';
      h += '</div>';
      if (li) h += '<div style="font-size:11px;color:#FF4757">$' + li.orig + ' &rarr; $' + li.curr + ' max &middot; ' + li.date + '</div>';
      if (li && li.notes) h += '<div style="font-size:10px;color:#4A5568;margin-top:2px">' + li.notes + '</div>';
      if (risk&&!li) h += '<div style="font-size:11px;color:#F0A500">Win rate ' + bwr.toFixed(1) + '% over ' + bb.length + ' bets — consider reducing stakes</div>';
      h += '</div>';
      h += '<div style="text-align:right">';
      h += '<div style="font-size:14px;font-weight:900;color:' + (bpr>=0?"#4ECDC4":"#FF4757") + '">' + (bpr>=0?"+":"") + "$" + bpr.toFixed(0) + '</div>';
      h += '<div style="font-size:9px;color:#374151">' + bb.length + ' positions</div>';
      h += '<div style="font-size:9px;color:' + dangerColor + ';margin-top:4px">RISK: ' + dangerLabel + '</div>';
      h += '</div></div>';

      // Danger bar
      h += '<div style="margin-bottom:10px">';
      h += '<div style="display:flex;justify-content:space-between;font-size:9px;color:#374151;margin-bottom:3px"><span>DANGER SCORE</span><span style="color:' + dangerColor + '">' + danger + '/100</span></div>';
      h += '<div class="prog-wrap"><div class="prog-fill" style="width:' + danger + '%;background:' + dangerColor + '"></div></div>';
      h += '</div>';

      h += '<div class="g3">';
      h += mc("EDGE EXEC RATE", bwr.toFixed(1)+"%", bwr>=52.4?"#4ECDC4":"#FF4757");
      h += mc("AVG CLV", fmtPct(bcv), bcv>=0?"#4ECDC4":"#FF4757");
      h += mc("STATUS", li?"$"+li.curr+" MAX":"ACTIVE", li?"#FF4757":"#4ECDC4");
      h += '</div></div>';
    });
    pg.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "breakdown") {
    var h = sw;
    h += '<div class="sec-title" style="color:#374151;margin-bottom:10px">EDGE BREAKDOWN BY SPORT</div>';

    var sportRows = SPORTS.map(function(sp) {
      var sb = st.s.filter(function(b){ return b.sport===sp; });
      var sw2 = sb.filter(function(b){ return b.result==="W"; }).length;
      var wr2 = sb.length ? sw2/sb.length*100 : 0;
      var profit = sb.reduce(function(a,b){ return b.result==="W"?a+b.stake*(b.betOdds-1):b.result==="L"?a-b.stake:a; },0);
      var clv2 = sb.reduce(function(a,b){ return a+calcCLV(b.betOdds,b.closingOdds); },0)/(sb.length||1);
      return {sport:sp, n:sb.length, wr:wr2, profit:profit, clv:clv2};
    });

    h += '<div class="card" style="margin-bottom:10px;padding:14px">';
    if (st.total === 0) {
      h += '<div style="color:#374151;font-size:11px;text-align:center;padding:20px">No data yet. Log positions in Tracker to see breakdown.</div>';
    } else {
      sportRows.forEach(function(r) {
        if (r.n === 0) return;
        h += '<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.04)">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        h += '<div style="display:flex;gap:8px;align-items:center">';
        h += '<span style="font-size:12px;font-weight:700;color:' + (SC[r.sport]||"#FF6B35") + '">' + r.sport + '</span>';
        h += '<span style="font-size:9px;color:#374151">' + r.n + ' positions</span>';
        h += '</div>';
        h += '<div style="display:flex;gap:12px;font-size:10px">';
        h += '<span style="color:' + (r.wr>=52.4?"#4ECDC4":"#FF4757") + '">' + r.wr.toFixed(1) + '% WR</span>';
        h += '<span style="color:' + (r.clv>=0?"#4ECDC4":"#FF4757") + '">' + fmtPct(r.clv) + ' CLV</span>';
        h += '<span style="color:' + (r.profit>=0?"#4ECDC4":"#FF4757") + ';font-weight:700">' + (r.profit>=0?"+":"") + "$" + r.profit.toFixed(0) + '</span>';
        h += '</div></div>';
        h += '<div class="prog-wrap"><div class="prog-fill" style="width:' + Math.min(r.wr/70*100,100) + '%;background:' + (r.wr>=52.4?SC[r.sport]||"#FF6B35":"#FF4757") + '"></div></div>';
        h += '</div>';
      });
    }
    h += '</div>';

    // Bookmaker breakdown
    h += '<div class="sec-title" style="color:#374151;margin-bottom:10px">EDGE BREAKDOWN BY BOOKMAKER</div>';
    h += '<div class="card" style="margin-bottom:10px;padding:14px">';
    if (st.total === 0) {
      h += '<div style="color:#374151;font-size:11px;text-align:center;padding:20px">No data yet.</div>';
    } else {
      BOOKS.forEach(function(bk) {
        var bb = st.s.filter(function(b){ return b.bk===bk.k; });
        if (bb.length === 0) return;
        var bw2 = bb.filter(function(b){ return b.result==="W"; }).length;
        var bwr2 = bw2/bb.length*100;
        var bpr2 = bb.reduce(function(a,b){ return b.result==="W"?a+b.stake*(b.betOdds-1):b.result==="L"?a-b.stake:a; },0);
        var bcv2 = bb.reduce(function(a,b){ return a+calcCLV(b.betOdds,b.closingOdds); },0)/(bb.length||1);
        h += '<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.04)">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        h += '<div style="display:flex;gap:8px"><span style="font-size:11px;font-weight:700;color:' + bk.c + '">' + bk.l + '</span><span style="font-size:9px;color:#374151">' + bb.length + ' bets</span></div>';
        h += '<div style="display:flex;gap:10px;font-size:10px">';
        h += '<span style="color:' + (bwr2>=52.4?"#4ECDC4":"#FF4757") + '">' + bwr2.toFixed(1) + '%</span>';
        h += '<span style="color:' + (bcv2>=0?"#4ECDC4":"#FF4757") + '">' + fmtPct(bcv2) + ' CLV</span>';
        h += '<span style="color:' + (bpr2>=0?"#4ECDC4":"#FF4757") + ';font-weight:700">' + (bpr2>=0?"+":"") + "$" + bpr2.toFixed(0) + '</span>';
        h += '</div></div>';
        h += '<div class="prog-wrap"><div class="prog-fill" style="width:' + Math.min(bwr2/70*100,100) + '%;background:' + (bpr2>=0?bk.c:"#FF4757") + '"></div></div>';
        h += '</div>';
      });
    }
    h += '</div>';

    // Insights
    var insights = [];
    sportRows.forEach(function(r) {
      if (r.n >= 5 && r.clv >= 1) insights.push("Strong CLV in " + r.sport + " (" + fmtPct(r.clv) + ") — focus volume here");
      if (r.n >= 5 && r.profit < -20) insights.push("Negative P&L in " + r.sport + " — review edge or reduce exposure");
    });
    if (st.total < 50) insights.push("Only " + st.total + " positions logged. Need 200+ for reliable breakdown insights.");

    if (insights.length > 0) {
      h += '<div class="card card-orange" style="padding:14px">';
      h += '<div class="sec-title" style="color:#FF6B35;margin-bottom:8px">INTELLIGENCE INSIGHTS</div>';
      insights.forEach(function(ins) {
        h += '<div style="font-size:11px;color:#D1D5DB;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.04)">' + ins + '</div>';
      });
      h += '</div>';
    }
    pg.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────
  else if (t === "settings") {
    var h = sw;
    h += '<div class="sec-title" style="color:#374151;margin-bottom:10px">PLATFORM SETTINGS</div>';

    h += '<div class="card" style="margin-bottom:10px">';
    h += '<div class="sec-title" style="color:#FF6B35">BANKROLL & STAKING</div>';
    h += '<div class="g2" style="margin-top:10px">';
    h += '<div><label class="lbl">BANKROLL $</label><input type="number" value="' + S.bankroll + '" onchange="S.bankroll=parseFloat(this.value)||0;document.getElementById(\'bk-inp\').value=S.bankroll;uBar()"></div>';
    h += '<div><label class="lbl">KELLY FRACTION</label><div style="display:flex;align-items:center;gap:8px;margin-top:4px"><span style="font-size:12px;color:#FF6B35;font-weight:700" id="kf-disp">' + (S.kf*100).toFixed(0) + '%</span><input type="range" min="0.05" max="0.5" step="0.05" value="' + S.kf + '" oninput="S.kf=parseFloat(this.value);var e=document.getElementById(\'kf-disp\');if(e)e.textContent=(S.kf*100).toFixed(0)+\'%\'"></div></div>';
    h += '</div>';
    h += '<div style="margin-top:8px;font-size:10px;color:#4A5568">Recommended: 25% Kelly. Never exceed 50%. Higher = more volatile.</div>';
    h += '</div>';

    h += '<div class="card card-orange" style="margin-bottom:10px;padding:14px">';
    h += '<div class="sec-title" style="color:#FF6B35;margin-bottom:12px">DATA SOURCES</div>';
    [{name:"The Odds API",status:"Live odds &middot; AFL NBA NFL NRL MLB &middot; Decimal format",color:"#4ECDC4"},
     {name:"Anthropic Claude",status:"Market Intelligence Engine &middot; Edge analysis &middot; Set ANTHROPIC_API_KEY in Railway",color:"#FF6B35"},
     {name:"Railway Server",status:"edgestack-proxy-production.up.railway.app &middot; Always on",color:"#4ECDC4"},
     {name:"Fair Price Engine",status:"Pinnacle margin-stripped true probability &middot; Simple margin removal method",color:"#4ECDC4"},
     {name:"API Requests",status:(S.remReq?S.remReq+" remaining this month":"Check Live Odds tab for count"),color:S.remReq&&parseInt(S.remReq)<50?"#FF4757":"#4ECDC4"}
    ].forEach(function(src) {
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.04)">';
      h += '<div><div style="font-size:12px;font-weight:600">' + src.name + '</div><div style="font-size:10px;color:#4A5568">' + src.status + '</div></div>';
      h += '<div class="tag" style="color:' + src.color + ';background:' + src.color + '14">ACTIVE</div>';
      h += '</div>';
    });
    h += '</div>';

    h += '<div class="card card-red" style="padding:14px">';
    h += '<div class="sec-title" style="color:#FF4757;margin-bottom:10px">DISCIPLINE RULES</div>';
    h += '<div style="font-size:11px;color:#D1D5DB;line-height:1.8">';
    h += '&middot; Never bet more than Kelly recommendation<br>';
    h += '&middot; Maximum 1% of bankroll on any multi<br>';
    h += '&middot; Stop after 5 consecutive losses — review CLV<br>';
    h += '&middot; Never override a negative EV signal with opinion<br>';
    h += '&middot; Price &gt; Prediction. Always.<br>';
    h += '&middot; Target: 500+ bets before drawing conclusions<br>';
    h += '</div></div>';
    pg.innerHTML = h;
  }

  uBar();
}

// ═══════════════════════════════════════════════════════════
//  INTERACTIVE FUNCTIONS
// ═══════════════════════════════════════════════════════════

function toggleEl(id) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle("hidden");
}

function addBet() {
  function gv(id) { var e=document.getElementById(id); return e?e.value:""; }
  var bo = parseFloat(gv("nb-betOdds"))||2.0;
  var prob = parseFloat(gv("nb-prob"))||52;
  var ev = calcEV(bo, prob);

  // Discipline check
  if (ev < 0) {
    if (!confirm("This bet has NEGATIVE EV (" + (ev*100).toFixed(2) + "%). You are overriding the model. Proceed?")) return;
  }

  S.bets.push({
    id: Date.now(),
    date: gv("nb-date") || new Date().toISOString().split("T")[0],
    sport: gv("nb-sport"),
    game: gv("nb-game"),
    pick: gv("nb-pick"),
    betOdds: bo,
    closingOdds: parseFloat(gv("nb-closingOdds"))||bo,
    result: gv("nb-result"),
    bk: gv("nb-bk"),
    stake: parseFloat(gv("nb-stake"))||0,
    ev: ev,
    trueProb: prob
  });
  toggleEl("abf");
  uBar();
  renderPage();
}

function prefillBet(vb) {
  goTab("tracker");
  setTimeout(function() {
    toggleEl("abf");
    setTimeout(function() {
      function sv(id,val){ var e=document.getElementById(id); if(e)e.value=val; }
      sv("nb-date", new Date().toISOString().split("T")[0]);
      sv("nb-sport", vb.sport);
      sv("nb-game", vb.game);
      sv("nb-pick", vb.pick);
      sv("nb-betOdds", vb.bookOdds);
      sv("nb-closingOdds", vb.bookOdds);
      sv("nb-bk", vb.book);
      sv("nb-stake", vb.stakeDollars);
      sv("nb-prob", vb.trueProb.toFixed(1));
    }, 100);
  }, 100);
}

function settleBet(id, result) {
  S.bets = S.bets.map(function(b) {
    if (b.id !== id) return b;
    return {id:b.id,date:b.date,sport:b.sport,game:b.game,pick:b.pick,betOdds:b.betOdds,closingOdds:b.closingOdds,result:result,bk:b.bk,stake:b.stake,ev:b.ev,trueProb:b.trueProb};
  });
  uBar(); renderPage();
}

function addLimit() {
  function gv(id){ var e=document.getElementById(id); return e?e.value:""; }
  S.limits.push({
    id: Date.now(),
    bk: gv("nl-bk"),
    orig: parseFloat(gv("nl-orig"))||0,
    curr: parseFloat(gv("nl-curr"))||0,
    date: gv("nl-date"),
    notes: gv("nl-notes"),
    history: [parseFloat(gv("nl-orig"))||0, parseFloat(gv("nl-curr"))||0]
  });
  toggleEl("alf");
  uBar(); renderPage();
}

function removeLeg(id) { S.legs = S.legs.filter(function(l){ return l.id!==id; }); renderPage(); }
function addLeg() { S.legs.push({id:Date.now(),pick:"",odds:2.0,wp:55,sport:"AFL"}); renderPage(); }
function updateLeg(id,field,val) {
  S.legs = S.legs.map(function(l) {
    if (l.id!==id) return l;
    var n = {id:l.id,pick:l.pick,odds:l.odds,wp:l.wp,sport:l.sport};
    n[field] = val; return n;
  });
  renderPage();
}

function calcMulti() {
  var legs = S.legs.filter(function(l){ return l.odds>1 && l.wp>0; });
  if (legs.length < 2) return null;
  var combinedOdds = legs.reduce(function(a,l){ return a*l.odds; }, 1);
  var trueProb = legs.reduce(function(a,l){ return a*(l.wp/100); }, 1)*100;
  var ev = calcEV(combinedOdds, trueProb);
  return {
    combinedOdds: combinedOdds,
    prob: trueProb,
    ev: ev,
    allPos: legs.every(function(l){ return (l.wp - d2i(l.odds)) > 0; }),
    n: legs.length
  };
}

function setManualOdds(gid, bk, val) {
  if (!S.mOdds[gid]) S.mOdds[gid] = {};
  S.mOdds[gid][bk] = val;
  renderPage();
}

function uKelly() {
  var wp = parseFloat((document.getElementById("kw")||{value:55}).value);
  var bo = parseFloat((document.getElementById("ko")||{value:2.0}).value);
  var edge = (wp - d2i(bo)).toFixed(2);
  var hk = kellyStake(wp, bo, S.kf);
  var bs = (S.bankroll * hk / 100).toFixed(2);

  var r = document.getElementById("kr");
  if (r) r.innerHTML = mc("EDGE", (parseFloat(edge)>=0?"+":"") + edge + "%", parseFloat(edge)>=0?"#4ECDC4":"#FF4757")
    + mc("KELLY %", hk.toFixed(2)+"%", "#FF6B35")
    + mc("STAKE SIZE", "$"+bs, "#F0A500");

  var w = document.getElementById("kw2");
  if (w) w.innerHTML = parseFloat(edge) <= 0
    ? '<div class="warn" style="margin-top:10px">NEGATIVE EDGE &mdash; DO NOT BET. The model says no.</div>'
    : '';

  var p = document.getElementById("kp");
  if (p) {
    var ph = "";
    [{p:"1 MONTH",n:90},{p:"3 MONTHS",n:270},{p:"1 YEAR",n:1095}].forEach(function(x) {
      var w2 = Math.round(x.n*0.55), st2 = parseFloat(bs);
      var prf = w2*st2*(bo-1) - (x.n-w2)*st2;
      ph += mc(x.p, "$"+(S.bankroll+prf).toFixed(0), prf>=0?"#4ECDC4":"#FF4757");
    });
    p.innerHTML = ph;
  }
}

function uCLV() {
  var b = parseFloat((document.getElementById("cb")||{value:2.1}).value);
  var c = parseFloat((document.getElementById("cc")||{value:1.95}).value);
  var cvv = calcCLV(b, c);

  var r = document.getElementById("clvr");
  if (r) r.innerHTML = mc("YOUR IMPLIED", d2i(b).toFixed(1)+"%", "#45B7D1")
    + mc("PINNACLE CLOSE", d2i(c).toFixed(1)+"%", "#45B7D1")
    + mc("CLV", fmtPct(cvv), cvv>=0?"#4ECDC4":"#FF4757");

  var v = document.getElementById("clvv");
  if (v) v.innerHTML = '<div style="padding:10px 12px;background:' + (cvv>=0?"rgba(78,205,196,.05)":"rgba(255,71,87,.05)") + ';border:1px solid ' + (cvv>=0?"rgba(78,205,196,.16)":"rgba(255,71,87,.16)") + ';border-radius:8px;font-size:11px;color:' + (cvv>=0?"#4ECDC4":"#FF4757") + '">' + (cvv>=0?"POSITIVE CLV &mdash; You beat the close. Verified edge.":"NEGATIVE CLV &mdash; Market moved against you. Review your process.") + '</div>';
}

// ── Init ──────────────────────────────────────────────────────
renderTabs();
renderPage();
