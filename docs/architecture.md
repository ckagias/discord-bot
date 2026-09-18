# Architecture

## Directory layout

| Path | Purpose |
|---|---|
| `src/` | Bot entrypoint (`index.ts`), internal REST API server (`internalApi.ts`), slash-command registration script (`cmd.ts`), data-cleanup script (`clean.ts`) |
| `events/` | discord.js event listeners (`interactionCreate.ts`, `messageCreate.ts`, `voiceStateUpdate.ts`, etc.) |
| `handlers/` | Dispatch/registration logic: `eventHandler.ts`, `slashCommandHandler.ts`, `componentHandler.ts`, `lavalinkHandler.ts` |
| `handlers/components/` | Button/modal/select-menu interaction logic (tickets, polls, hangman, blackjack, heist, giveaways, suggestions, reaction roles, temp-VC panel, embed builder) |
| `slashCommands/` | All `/` command implementations, grouped into 11 category subfolders, see [Commands Reference](commands.md) |
| `models/` | 25 Mongoose schemas, see [Data Models](data-models.md) |
| `utils/` | Shared business logic: economy, moderation (automod, anti-raid, punishments, warn thresholds, cases), music/Lavalink persistence, birthdays, welcome messages, starboard, minigame logic, logging, guild config cache, env validation, retry-safe upserts |
| `types/` | Ambient/module type augmentations (`discord.d.ts`) |
| `dashboard/` | Separate Next.js app, shares the bot's MongoDB, see [Dashboard](dashboard.md) |
| `lavalink/` | Lavalink node config (`application.yml`) + bundled YouTube source plugin jar |
| `tests/` | Jest suite mirroring the source tree 1:1, see [Testing](testing.md) |
| `data/` | Static data files (e.g. trivia question sets) |

## Command flow

1. `src/cmd.ts` registers slash command definitions with Discord on deploy (`restart.sh --commands`).
2. Discord sends an interaction → `events/interactionCreate.ts` receives it.
3. `handlers/slashCommandHandler.ts` routes to the matching file in `slashCommands/<category>/`.
4. Button/modal/select follow-ups route through `handlers/componentHandler.ts` into `handlers/components/`, matched by exact custom-ID or prefix (see `CONTRIBUTING.md` for the two matching styles).
5. Command/component code reads and writes Mongo through `models/`, using shared helpers in `utils/` for anything with cross-command logic (economy balances, moderation cases, guild config).

## Bot ↔ dashboard relationship

The dashboard is a **separate Next.js process** that shares the bot's MongoDB connection string (`MONGODB_URL`). Two distinct paths exist between them:

- **Dashboard reads/writes Mongo directly** for anything that's just settings/config state, e.g. editing automod rules, viewing moderation cases, managing the shop. No round-trip through the bot process is needed since both sides read the same collections.
- **Dashboard calls the bot's Internal API** for anything that needs to affect the *live, in-memory* bot process: ending a giveaway right now, rerolling winners, locking down a raid. Database state alone can't trigger those. The bot process has to act. See [Internal API](internal-api.md).

This split is why `GuildSchema` (the per-guild settings document) is read/written from both sides, while giveaway-ending and antiraid lock/unlock only ever happen through the API.

## Guild config caching

`utils/` includes a guild config cache sitting in front of `GuildSchema` reads, since nearly every command and event handler needs guild settings and hitting Mongo per-interaction would add latency. See `CHANGELOG.md` for when this was introduced (perf pass).
