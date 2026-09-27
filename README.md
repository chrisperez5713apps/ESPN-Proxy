# League Manager Dashboard

Self-hosted fantasy football dashboard: pulls league data automatically and tracks a
shared money pot — weekly side-contests, season standings, and a live net-balance
ledger. No manual score entry.

- `/` → ESPN dashboard (`public/index.html`)
- `/sleeper.html` → Sleeper dashboard (`public/sleeper.html`)

## How it works

`server.js` is an Express server with three jobs:

1. Serves static files from `/public`
2. Proxies ESPN + Sleeper API calls server-side. Browsers can't fetch either API
   directly from some environments (CORS + sandbox restrictions), so the server
   fetches instead. ESPN needs browser-like headers (`ESPN_HEADERS`) and login
   cookies (`ESPN_S2` / `ESPN_SWID` env vars) for pre-2025 seasons. Sleeper's API
   is fully public — no auth needed.
3. Stores small shared state (champion/runner-up picks) in `settings.json`
   (gitignored, created at runtime) so all viewers see the same picks.
   Sleeper picks are namespaced per league (`sleeper:<leagueId>`).

## Env vars

| Var | Used by | Purpose |
|---|---|---|
| `ESPN_S2`, `ESPN_SWID` | ESPN dashboard | ESPN login cookies (server-side only, never in git) |
| `ESPN_APP_NAME` | `/` | Header title (default: The Degenerates) |
| `SLEEPER_APP_NAME` | `/sleeper.html` | Fallback title before sync (default: Sleeper League) |
| `DEFAULT_ESPN_LEAGUE_ID` / `DEFAULT_ESPN_YEAR` | `/` | Pre-fill Setup tab |
| `DEFAULT_SLEEPER_LEAGUE_ID` | `/sleeper.html` | Pre-fill League ID input |

## Deploy on Render (free)

1. Render dashboard → New → **Blueprint** → connect this repo.
2. When prompted, enter `ESPN_S2` and `ESPN_SWID` (from your ESPN cookies).
3. Deploy. Both services go live:
   - `degenerates-league-manager` → ESPN dashboard
   - `pcb-league-manager` → Sleeper dashboard for The PCB League

Free-tier notes: services sleep after 15 min idle (first load takes ~30–60s),
and `settings.json` resets on restart — champion/runner-up picks would need
re-entering after a redeploy.

## API routes

- `GET /teams/:leagueId/:year`, `GET /week/:leagueId/:year/:week` — ESPN proxy
- `GET /sleeper/league/:leagueId`, `/sleeper/users/:leagueId`, `/sleeper/rosters/:leagueId`, `/sleeper/matchups/:leagueId/:week` — Sleeper proxy
- `GET /sleeper/players` — full NFL player dictionary, cached in memory for 24h
- `GET /config` — deployment defaults from env vars
- `GET /settings`, `POST /settings` — shared champion/runner-up picks
- `GET /debug` — checks whether ESPN cookies are set (lengths only)
