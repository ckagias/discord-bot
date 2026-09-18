# Deployment & Operations

Everything runs through Docker Compose. Never run raw `docker compose` commands directly, use the scripts below so the right build/restart order happens.

## Services (`docker-compose.yml`)

| Service | Purpose | Healthcheck |
|---|---|---|
| `lavalink` | Audio node | `wget` against `/version` |
| `mongodb` | Mongo 7 | `mongosh` ping |
| `bot` | Discord bot + internal API, depends on `mongodb` and `lavalink` being healthy | `wget` against `/internal/health` |
| `dashboard` | Next.js dashboard, depends on `mongodb` being healthy, talks to bot via `BOT_INTERNAL_URL` | `wget` against `/api/health` |

Shared `bot-network` bridge network, `mongo_data` volume, JSON-file logging with size/rotation caps on every service.

## Scripts

### `start.sh`

`docker compose up -d`, starts every service.

### `stop.sh`

`docker compose down`, stops every service.

### `restart.sh`

| Flag | Effect |
|---|---|
| (none) | Restart lavalink, rebuild+restart bot, re-register slash commands, rebuild+restart dashboard |
| `--commands` | Re-register slash commands only, no image rebuild |
| `--bot` | Rebuild and restart the bot container only |
| `--dashboard` | Rebuild and restart the dashboard container only |
| `--lavalink` / `--music` | Restart the lavalink container only |

### `backup.sh`

`mongodump`s the `discordbot` database from the `mongodb` container into a gzip archive under `./backups`, then deletes archives older than `RETENTION_DAYS` (default 14). Override `BACKUP_DIR` or `RETENTION_DAYS` as env vars.

### `restore.sh <archive.gz>`

`mongorestore --drop`s a backup archive into the `mongodb` container. Prompts for confirmation before running since `--drop` replaces existing data.

## Docker images

- **Bot** (`Dockerfile`): multi-stage, Node 25 Alpine. Build stage runs `npm ci` + `tsc`. Production stage runs `npm ci --omit=dev`, runs as non-root `node` user, healthcheck hits `/internal/health` on `INTERNAL_API_PORT`.
- **Dashboard** (`dashboard/Dockerfile`): separate multi-stage build for the Next.js app.

## Backups

Run `backup.sh` on a schedule (cron or similar) if you want ongoing backups, it's not run automatically by Compose. See `SECURITY.md` for handling of the resulting archives, they contain full database contents.
