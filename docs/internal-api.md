# Internal API

A plain `node:http` server in `src/internalApi.ts` (no Express), started from `src/index.ts`. Lets the dashboard trigger actions on the live bot process, not just read/write Mongo. Not meant to be reachable outside the Docker network.

## Auth

Every route except `/internal/health` requires header `x-internal-secret` matching `INTERNAL_API_SECRET`, checked with `timingSafeEqual` to avoid timing attacks. No secret configured means every authenticated route rejects.

## Rate limiting

Fixed 10-second window, max 10 requests per route, tracked in-memory per pathname. Exceeding it returns `429` with a `Retry-After` header. Resets on restart since the limiter state is in-memory.

## Request limits

Bodies over 1 MB are rejected and the connection is destroyed.

## Routes

### `GET /internal/health`

No auth required. Returns bot/Mongo status:

```json
{ "discord": "up", "mongo": "up", "ping": 42, "uptime": 123456 }
```

Used by the Docker healthcheck and the dashboard's health page.

### `POST /internal/giveaway/end`

Body: `{ guildId, messageId }`. Ends an active giveaway immediately. 404 if no matching active giveaway.

### `POST /internal/giveaway/reroll`

Body: `{ guildId, messageId }`. Rerolls winners for an already-ended giveaway, respecting `requireRoleId` eligibility if set. Edits the original embed and posts a new winner announcement. 404 if no matching ended giveaway.

### `POST /internal/suggestion/status`

Body: `{ guildId, messageId, status, staffId }`. `status` must be `approved`, `denied`, or `implemented`. 404 if no pending suggestion matches.

### `POST /internal/antiraid/lock`

Body: `{ guildId, username }`. Starts a lockdown. Fails with `400` if no quarantine role is configured or the role no longer exists, `409` if a lockdown is already active.

### `POST /internal/antiraid/unlock`

Body: `{ guildId, username }`. Ends a lockdown, returns the count of released members. `409` if no lockdown is active.

Anything else returns `404`.

## Config

See [Environment & Configuration](environment.md) for `INTERNAL_API_PORT`, `INTERNAL_API_SECRET`, `BOT_INTERNAL_URL`.

Covered by `tests/src/internalApi.test.ts`.
