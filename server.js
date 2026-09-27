import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons";

const espnCookie =
  process.env.ESPN_S2 && process.env.ESPN_SWID
    ? `espn_s2=${process.env.ESPN_S2}; SWID=${process.env.ESPN_SWID}`
    : "";

const ESPN_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "application/json",
  Referer: "https://fantasy.espn.com/",
  ...(espnCookie ? { Cookie: espnCookie } : {}),
};

app.get("/debug", (req, res) => {
  res.json({
    hasEspnS2: !!process.env.ESPN_S2,
    hasEspnSwid: !!process.env.ESPN_SWID,
    espnS2Length: process.env.ESPN_S2 ? process.env.ESPN_S2.length : 0,
    swidPreview: process.env.ESPN_SWID ? process.env.ESPN_SWID.slice(0, 6) + "..." : null,
  });
});

app.get("/teams/:leagueId/:year", async (req, res) => {
  const { leagueId, year } = req.params;
  try {
    const r = await fetch(`${BASE}/${year}/segments/0/leagues/${leagueId}?view=mTeam`, { headers: ESPN_HEADERS });
    if (!r.ok) return res.status(r.status).json({ error: `ESPN returned ${r.status}` });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/week/:leagueId/:year/:week", async (req, res) => {
  const { leagueId, year, week } = req.params;
  try {
    const r = await fetch(
      `${BASE}/${year}/segments/0/leagues/${leagueId}?view=mMatchupScore&view=mBoxscore&scoringPeriodId=${week}`,
      { headers: ESPN_HEADERS }
    );
    if (!r.ok) return res.status(r.status).json({ error: `ESPN returned ${r.status}` });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- deployment config (lets one codebase serve multiple leagues) ----------
app.get("/config", (req, res) => {
  res.json({
    espnAppName: process.env.ESPN_APP_NAME || "The Degenerates",
    sleeperAppName: process.env.SLEEPER_APP_NAME || "Sleeper League",
    defaultEspnLeagueId: process.env.DEFAULT_ESPN_LEAGUE_ID || "",
    defaultEspnYear: process.env.DEFAULT_ESPN_YEAR || "2026",
    defaultSleeperLeagueId: process.env.DEFAULT_SLEEPER_LEAGUE_ID || "",
    defaultBuyIn: process.env.DEFAULT_BUY_IN || "",
  });
});

// ---------- Sleeper proxy ----------
// Sleeper's API is fully public (no auth), but it's proxied server-side like
// ESPN because browsers can't fetch it directly from this environment
// (CORS + sandbox restrictions). Do not reintroduce client-side fetches to
// api.sleeper.app.
const SLEEPER_BASE = "https://api.sleeper.app/v1";

async function sleeperFetch(url, res) {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return res.status(r.status).json({ error: `Sleeper returned ${r.status}` });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

app.get("/sleeper/league/:leagueId", (req, res) =>
  sleeperFetch(`${SLEEPER_BASE}/league/${req.params.leagueId}`, res)
);
app.get("/sleeper/users/:leagueId", (req, res) =>
  sleeperFetch(`${SLEEPER_BASE}/league/${req.params.leagueId}/users`, res)
);
app.get("/sleeper/rosters/:leagueId", (req, res) =>
  sleeperFetch(`${SLEEPER_BASE}/league/${req.params.leagueId}/rosters`, res)
);
app.get("/sleeper/matchups/:leagueId/:week", (req, res) =>
  sleeperFetch(`${SLEEPER_BASE}/league/${req.params.leagueId}/matchups/${req.params.week}`, res)
);

// ~5MB player dictionary, cached in memory for 24h. Do NOT remove the cache —
// without it every sync re-downloads the full file.
let playersCache = null;
let playersCacheAt = 0;
const PLAYERS_TTL_MS = 24 * 60 * 60 * 1000;

app.get("/sleeper/players", async (req, res) => {
  try {
    if (!playersCache || Date.now() - playersCacheAt > PLAYERS_TTL_MS) {
      const r = await fetch(`${SLEEPER_BASE}/players/nfl`, { headers: { Accept: "application/json" } });
      if (!r.ok) return res.status(r.status).json({ error: `Sleeper returned ${r.status}` });
      playersCache = await r.json();
      playersCacheAt = Date.now();
    }
    res.json(playersCache);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const SETTINGS_FILE = path.join(__dirname, "settings.json");
function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    return {};
  }
}
function writeSettings(s) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s));
}

app.get("/settings", (req, res) => res.json(readSettings()));
app.post("/settings", (req, res) => {
  const next = { ...readSettings(), ...req.body };
  writeSettings(next);
  res.json(next);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on ${port}`));
