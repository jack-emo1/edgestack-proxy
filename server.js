const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const ODDS_KEY = process.env.ODDS_API_KEY || "ca6d6693352b4b3e3ea11856734a9870";
const AI_KEY = process.env.ANTHROPIC_API_KEY || "";
const ODDS_BASE = "https://api.the-odds-api.com/v4";

// ── Odds proxy ──────────────────────────────────────────────
app.get("/api/odds/:sport", async (req, res) => {
  try {
    const { sport } = req.params;
    const regions = req.query.regions || "us,au,uk";
    const markets = req.query.markets || "h2h,spreads,totals";
    const url = `${ODDS_BASE}/sports/${sport}/odds/?apiKey=${ODDS_KEY}&regions=${regions}&markets=${markets}&oddsFormat=decimal`;
    const r = await fetch(url);
    const data = await r.json();
    const rem = r.headers.get("x-requests-remaining");
    if (rem) res.set("x-requests-remaining", rem);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Closing line proxy (for automated CLV) ──────────────────
app.get("/api/closing/:sport/:eventId", async (req, res) => {
  try {
    const { sport, eventId } = req.params;
    const url = `${ODDS_BASE}/sports/${sport}/scores/?apiKey=${ODDS_KEY}&daysFrom=1&eventIds=${eventId}`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── News/injury proxy ───────────────────────────────────────
app.get("/api/news/:sport", async (req, res) => {
  try {
    const { sport } = req.params;
    const queries = {
      AFL: "AFL team sheet injury news today",
      NBA: "NBA injury report today",
      NFL: "NFL injury report today",
      NRL: "NRL team list today",
      MLB: "MLB lineup today"
    };
    const q = encodeURIComponent(queries[sport] || sport + " injury news");
    const url = `https://newsdata.io/api/1/news?apikey=pub_free&q=${q}&language=en&category=sports`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AI Analysis proxy ───────────────────────────────────────
app.post("/api/analyse", async (req, res) => {
  try {
    if (!AI_KEY) return res.json({ content: [{ type: "text", text: "ANTHROPIC_API_KEY not set in Railway environment variables." }] });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": AI_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Static files ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("EDGE//STACK v3.0 on port " + PORT));
