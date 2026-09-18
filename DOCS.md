# Documentation

Technical reference for how this project works and why it's built the way it is. `README.md` is the pitch. This is the manual. `CONTRIBUTING.md` covers how to add code. This covers how the system fits together.

## Contents

- [Architecture](docs/architecture.md): directory layout, request/event flow, how the bot and dashboard talk to each other
- [Commands Reference](docs/commands.md): every slash command by category
- [Data Models](docs/data-models.md): every Mongoose schema and what it's for
- [Environment & Configuration](docs/environment.md): every env var, what it does, where it's consumed
- [Dashboard](docs/dashboard.md): Next.js app structure, auth flow, route-to-model mapping
- [Internal API](docs/internal-api.md): the bot's HTTP API used by the dashboard
- [Music & Lavalink](docs/music-lavalink.md): session resume, queue persistence, restart survival
- [Deployment & Operations](docs/deployment.md): Docker services, start/stop/restart scripts, backups
- [Testing](docs/testing.md): test layout, what's covered, how to run scoped vs. full suites

## Why these decisions

**TypeScript over JavaScript.** Full migration completed across a 9-PR sequence, see `CHANGELOG.md` for the version history. Catches command-argument and schema-shape mistakes at compile time across a codebase with 85+ commands and 25 data models.

**MongoDB shared between bot and dashboard.** The dashboard reads and writes the same collections the bot does directly, rather than going through the bot for every operation. This keeps the dashboard fast for read-heavy settings pages. Writes that need to affect a *live* bot process in memory (ending a giveaway, locking down a raid) go through the [Internal API](docs/internal-api.md) instead, since those aren't just database state.

**A hand-rolled internal API instead of a public one.** The dashboard and bot are deployed together and trust each other via a shared secret (`INTERNAL_API_SECRET`), not OAuth or public auth. It's not meant to be reachable from outside the Docker network. See [Internal API](docs/internal-api.md).

**Lavalink session resume + Mongo-backed queue store.** Music state (queue, now-playing, player config) is not held only in the Lavalink node's memory. Restarting the bot container (`restart.sh --bot`) does not kill playback, because Lavalink is configured to hold the player open for `LAVALINK_RESUME_TIMEOUT_MS` and the bot restores queue + player state from Mongo on reconnect. See [Music & Lavalink](docs/music-lavalink.md).

**Tests mirror the source tree under `tests/`**, not co-located with source files. Makes it easy to see what's covered and what isn't at a glance from the directory structure alone.

## Maintenance

Whenever a change adds, removes, or alters a route, page, component, env var, or architectural decision, update the relevant file here in the same change (per `CLAUDE.md`). Most changes only touch one of the linked files below, not this index.
