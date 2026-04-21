const express = require("express");
const cors = require("cors");
const app = express();
 
// Allow requests from anywhere (Claude artifact, your browser, etc)
app.use(cors());
app.use(express.json());
 
const ODDS_API_KEY = process.env.ODDS_API_KEY || "ca6d6693352b4b3e3ea11856734a9870";
const ODDS_BASE = "https://api.the-odds-api.com/v4";
 
// Health check
app.get("/", (req, res) => {
  res.json({ status: "EDGE//STACK Proxy Online", version: "1.0" });
});
 
// Proxy endpoint — passes through any odds API request
app.get("/odds/:sport", async (req, res) => {
  try {
    const { sport } = req.params;
    const { regions = "us,au", markets = "h2h,spreads,totals", oddsFormat = "american" } = req.query;
 
    const url = `${ODDS_BASE}/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}`;
 
    const response = await fetch(url);
    const data = await response.json();
 
    // Forward the remaining requests header
    const remaining = response.headers.get("x-requests-remaining");
    if (remaining) res.set("x-requests-remaining", remaining);
 
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
// Sports list endpoint
app.get("/sports", async (req, res) => {
  try {
    const response = await fetch(`${ODDS_BASE}/sports/?apiKey=${ODDS_API_KEY}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`EDGE//STACK Proxy running on port ${PORT}`));
