# Environment & Configuration

Copy `.env.example` to `.env` and fill in real values. Validated at startup by `utils/envCheck.ts`.

## Required (bot won't start without these)

| Variable | Purpose |
|---|---|
| `Token` | Discord bot token |
| `ClientID` | Discord application id |
| `MONGODB_URL` | MongoDB connection string |

## Feature-specific (optional, feature no-ops or errors gracefully without it)

| Variable | Purpose |
|---|---|
| `WEATHER_API_KEY` | OpenWeatherMap key, required for `/weather` |
| `GITHUB_TOKEN` | Used by `/github` info command |

## Bot presence

| Variable | Purpose |
|---|---|
| `BOT_ACTIVITY_NAME` | Status text shown in Discord |
| `BOT_ACTIVITY_TYPE` | Activity type (e.g. `Watching`) |

## Logging

| Variable | Purpose |
|---|---|
| `LOG_LEVEL` | `error` \| `warn` \| `info` \| `debug`. Defaults to `info`. |

## Lavalink (music)

| Variable | Purpose |
|---|---|
| `LAVALINK_HOST` | Leave as `lavalink` for Docker, use `127.0.0.1` for local dev outside Docker |
| `LAVALINK_PORT` | Defaults to `2333` |
| `LAVALINK_PASSWORD` | Shared with `lavalink/application.yml` via `${LAVALINK_PASSWORD}`, change from the default |
| `LAVALINK_RESUME_TIMEOUT_MS` | How long Lavalink holds a guild's player alive after the bot disconnects, in ms. Defaults to `60000` (60s). See [Music & Lavalink](music-lavalink.md). |

## Dashboard (only needed if running the dashboard service)

| Variable | Purpose |
|---|---|
| `CLIENT_SECRET` | Discord application client secret (OAuth) |
| `SESSION_SECRET` | Random string, 32+ chars, signs dashboard session cookies |
| `DASHBOARD_URL` | Public URL of the dashboard, e.g. `http://localhost:3000` |

## Internal API (bot ↔ dashboard)

| Variable | Purpose |
|---|---|
| `INTERNAL_API_PORT` | Port the bot's internal API listens on. Defaults to `4000`. |
| `INTERNAL_API_SECRET` | Shared secret, dashboard sends it in `x-internal-secret` header on every authenticated request |
| `BOT_INTERNAL_URL` | Base URL the dashboard uses to reach the bot's API. Defaults to `http://bot:4000` (Docker network hostname). Only override if running outside the default Compose setup |

See [Internal API](internal-api.md) for how these are used together.

## Security notes

- `INTERNAL_API_SECRET` and `SESSION_SECRET` should be long random values, not left as the placeholder. See `SECURITY.md`'s "Handling Secrets" section.
- `.env` is gitignored. Never commit real secrets. `.env.example` should only ever hold placeholders.
