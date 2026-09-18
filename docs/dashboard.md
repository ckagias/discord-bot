# Dashboard

A separate Next.js (App Router) app in `dashboard/`, sharing the bot's MongoDB via `MONGODB_URL`. Optional, see `dashboard/README.md` for enabling it.

## Structure

- `dashboard/app/page.tsx`, `layout.tsx`, `globals.css`: root app shell
- `dashboard/app/api/auth/`: Discord OAuth flow (`login`, `callback`, `logout`)
- `dashboard/app/api/health/`: health-check endpoint, checked by the Docker healthcheck
- `dashboard/app/dashboard/[guildId]/<category>/`: one route + `actions.ts` (server actions) per settings category: anti-raid, automod, birthdays, cases, economy, giveaways, leveling, moderation, reaction-roles, shop, starboard, suggestions, tempvc, thresholds, tickets, triggers, warnings, welcome. Each maps closely to a model in [Data Models](data-models.md) and to a config area on `GuildSchema`.
- `dashboard/components/`: shared UI (AccountMenu, GuildNav, SettingsCard/SettingsCardForm, Field, ContentColumn, etc.)
- `dashboard/lib/authorize.ts`: permission checks (who can view/edit a guild's settings)
- `dashboard/lib/db.ts`: Mongo connection
- `dashboard/lib/discord.ts`: Discord API calls
- `dashboard/lib/session.ts`: cookie/session handling
- `dashboard/lib/models/`: parallel Mongoose model set for the dashboard's own Mongo client, kept manually in sync with `models/` in the bot, see [Data Models](data-models.md#notes)

## Auth flow

Discord OAuth via `app/api/auth/`. Session state lives in a signed cookie (`SESSION_SECRET`), checked by `dashboard/lib/session.ts`. Per-guild access is gated by `dashboard/lib/authorize.ts`, permission checks run against the user's actual Discord roles/permissions in that guild, not a separate dashboard-only permission system.

## How writes reach the bot

Most settings pages write straight to Mongo through `lib/db.ts`, since the bot picks up config changes through its own reads (and the [guild config cache](architecture.md#guild-config-caching)). A few actions need to affect the bot's live process directly instead of just database state: ending a giveaway, rerolling winners, locking or unlocking a raid. Those go through the [Internal API](internal-api.md) via `BOT_INTERNAL_URL`.

## Testing

Separate test setup from the bot, Vitest instead of Jest (`dashboard/vitest.config.ts`). `dashboard/lib/__tests__/` covers `authorize`, `db`, `discord`, `forms`, `session`. Each `[guildId]/<category>/actions.ts` has its own `actions.test.ts`, mirroring the route tree. See [Testing](testing.md).
