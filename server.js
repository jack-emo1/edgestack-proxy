const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
 
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
 
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
 
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("EDGE//STACK running on port " + PORT));
