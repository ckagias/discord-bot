# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.0.5] - 2026-07-20

### Added

- `/weather` now enforces a 60-second per-user cooldown. Previously any user could spam the command and burn through the bot's shared OpenWeatherMap API quota across every guild.
- `LOG_LEVEL` documented in `.env.example` and the README env var table. It was already read by `utils/log.ts` but wasn't listed anywhere, so operators had no way to discover it short of reading the source.

## [1.0.4] - 2026-07-19

### Changed

- `uncaughtException` and `unhandledRejection` handlers in `src/index.ts` now log and then shut down the process (client destroy, Mongo close, exit) instead of only logging and continuing. Node's guidance is to treat the process as being in an undefined state after either fires; letting it limp on risked stuck locks or corrupted in-memory state until a manual restart. Docker's `restart: unless-stopped` now recovers automatically within seconds.

## [1.0.3] - 2026-07-19

### Fixed

- `events/messageCreate.ts`'s passive credit-on-message grant swallowed `updateBalance` failures with an empty `.catch(() => {})`, silently dropping currency on any transient Mongo error with no log trace. It now logs the failure like every other error path in the file.

## [1.0.2] - 2026-07-19

### Fixed

- `liftMute`/`liftBan` deleted the Mongo punishment record in a `finally` block even when the Discord unmute/unban call itself failed, permanently leaving the user muted or banned with no retry. The record is now only deleted when the lift succeeds, when the member/ban is already gone (Discord error codes 10007/10013/10026), or when the guild no longer exists. Any other failure keeps the record so `restorePunishments` retries it on the next bot restart.

## [1.0.1] - 2026-07-19

### Added

- `backup.sh` (`npm run backup`) dumps the `mongodb` container's `discordbot` database to a timestamped, gzipped archive under `backups/` and prunes archives older than 14 days. `restore.sh` restores from one of those archives, prompting for confirmation since it drops existing collections. No backup strategy existed before this: a `docker volume rm` on `mongo_data` lost everything permanently.

## [1.0.0] - 2026-07-18

### Added

- TypeScript tooling for the bot side (`tsconfig.json` with `allowJs`/`checkJs`, `typecheck` npm script, CI step). No source files converted yet, first step of an incremental JS-to-TS migration.
- Converted `utils/` (22 files) and their paired tests to TypeScript. Added `ts-jest` and ESLint TypeScript support (`typescript-eslint`) so converted files are linted and tested like any other source file. `typescript` pinned to `^5.9` instead of the newer major 7 since `ts-jest` doesn't support it yet.
- Converted `models/` (22 mongoose schemas) to TypeScript with full document interfaces (including nested subdocuments and enum unions), so later PRs converting `events/`, `handlers/`, and `slashCommands/` get real field-level type checking on every document these models touch.
- Converted `handlers/` and `handlers/components/` (16 files + 2 paired tests) to TypeScript. Added a `types/discord.d.ts` module augmentation for the custom properties (`commands`, `components`, `lavalink`, `embedDrafts`, `tempVCs`) the bot attaches to the discord.js `Client` at runtime.
- Converted `events/` (13 files + paired tests) to TypeScript, typing event handler signatures against discord.js's `GuildMember`, `Interaction`, `Message`, `MessageReaction`, `GuildBan`, and `VoiceState` types (and their partials where discord.js can emit one). Extended `types/discord.d.ts` with the `snipeCache`/`editSnipeCache` properties `messageDelete`/`messageUpdate` attach to the `Client` at runtime.
- Converted all 92 files in `slashCommands/` (plus paired tests) to TypeScript, split across three batches: `economy`, `fun`, `minigames`, `roles`, `settings`, `tickets` (29 files), `moderation`, `music` (35 files), and `info`, `leveling`, `utility` (28 files). `handlers/slashCommandHandler.ts`'s dynamic command-file scan now matches both `.js` and `.ts`, same fix already applied to `componentHandler.ts` and `eventHandler.ts`. Commands using mongoose models get real field-level type checking from the `Document` interfaces added in the `models/` PR. Music commands type against `client.lavalink`'s `LavalinkManager`. `handlers/eventHandler.ts`'s dynamic event-file scan now matches both `.js` and `.ts`, same as `componentHandler.ts` already did.
- A suggestion box: `/suggest submit`, `/suggest setup`, `/suggest list`, with up/down voting and a staff-only review flow. Approve, Deny, and Implement buttons only show up for permitted reviewers, never on the public message. Configurable via the command or the dashboard's Suggestions page, which also lists pending and resolved suggestions for review and deletion.
- Birthday announcements: `/birthday set/view/unset` for members to manage their own birthday per server, `/birthdayconfig set/unset` (Manage Server) to configure the announcement channel, message, and an optional day-only role, and a daily check scheduled from `clientReady` that self-aligns to local midnight. The birthday role is cleared from all holders each day before the day's new birthdays are granted it. Configurable via the dashboard's new Birthdays page as well.
- Rebuilt the dashboard Overview page with a 14-day message activity chart, a top-6 XP leaderboard, a recent activity feed for moderation and community events, and a stats card covering coins in circulation, active giveaways, shop items, reaction role messages, triggers, approved suggestions, and warn thresholds. Member names in these lists resolve and copy their user ID on click, the same pattern already used on Leveling, Tickets, Suggestions, and Warnings.
- `TempVCSchema` persists temp voice channel ownership to MongoDB, previously tracked only in an in-memory map that reset on every bot restart, so a bot restart no longer orphans active temp voice channels.

### Changed

- Comment audit across the bot and dashboard: collapsed multi-line `//` and JSDoc blocks to single lines, trimmed verbose explanations down to their single most important fact, and removed comments that just restated the code below them. No logic changes.
- Rewrote code instead of documenting around it wherever a comment existed only to explain unclear structure. `blackjack`, `coinflip`, and `rps` each split their inline PvP/vs-bot branches into named `handlePvp*`/`handleVsBot*`/`handleVsDealer` functions. `wordle`'s two-pass letter scoring became `markExactMatches`/`markPresentLetters`. `lyrics`'s two lookup strategies became `fetchStructuredLyrics`/`fetchLyricsViaSearch`. `purge` split into `bulkDeleteWithoutFilters`/`bulkDeleteWithFilters`. `warnthreshold`'s bare `2419200` literal now reuses the same named `MAX_TIMEOUT_SECONDS` pattern already used in `automod`. `handlers/components/blackjackAction.ts` deduplicated four identical inline "switch turn to opponent" blocks into one `switchTurnToOpponent` helper and extracted `buildWrongTurnMessage`/`isAutoStandTotal`/`handleSinglePlayerHit`. The dashboard's Temp VC page replaced a bare Discord channel-type literal with a named `DISCORD_CHANNEL_TYPE_CATEGORY` constant. No behavior changes intended, verified via the full test suite.
- Revamped the dashboard's layout and page structure. The old General section is gone. Its log channel setting moved into Moderation, and suggestion config moved into Suggestions. Warnings and Case Log are now one page shown side by side. Leveling's Settings and Level Roles cards merged into one card with a single Save button, and every settings card saves itself now instead of sharing a form wrapper that kept causing spacing bugs. All cards also picked up a subtle drop shadow.
- `messageCreate.ts`'s level-up now loops instead of checking a single `if`, so a large XP grant that crosses more than one level threshold advances every level instead of just one.
- The internal API's secret check now uses `crypto.timingSafeEqual` instead of a plain `!==` comparison, closing a timing side-channel on `INTERNAL_API_SECRET`.

### Fixed

- The bot has been unable to boot outside of Jest since the `utils/` TypeScript conversion: Docker ran `node src/index.js` directly against source with no build step, and plain Node's `require()` can't resolve extensionless requires to `.ts` files (only Jest's `ts-jest` transform could). Added a `build` npm script (`tsc`) and a CI step that runs it, switched the Dockerfile to a multi-stage build that compiles to `dist/` and runs the compiled output, and updated `restart.sh`'s slash-command registration to match. `dist/` is now gitignored and excluded from Jest's test matching.
- `data/` was excluded from the Docker build context, so `data/responses.js` (used by `/work`, `/dare`, `/8ball`, and `/truth`) was missing from the deployed container. Those commands have likely been throwing `Cannot find module` in production since Docker support was added. Unrelated to the TypeScript migration, caught while investigating a slowdown after the PR4 build changes.
- Dashboard `tsc --noEmit` had 5 real type errors, all in test files: `mongoose.connection.readyState` and `process.env.NODE_ENV` are typed readonly upstream even though tests assign them directly, and `lib/__tests__/discord.test.ts` called `vi.advanceTimersByTimeIfFake`, a Vitest API that doesn't exist. The readonly assignments now go through a narrow `as any` cast at each call site. The nonexistent-API call was dead code (no fake timers are set up in that file) and was deleted outright. Found while verifying the comment-audit change above didn't introduce new type errors.
- `guildBanAdd` looked up the ban's audit log entry with `AuditLogEvent.MemberBan`, which doesn't exist on the enum, so the fetch had no `type` filter and could attribute a ban to the moderator/reason of an unrelated recent audit event. Now uses `AuditLogEvent.MemberBanAdd`, matching the pattern already used in `guildBanRemove`. Found while typing `events/` in the previous PR, fixed here.
- `/database` deferred its reply non-ephemerally, then tried to make error replies ephemeral via `flags: MessageFlags.Ephemeral` on `editReply`, which has no effect since ephemerality is fixed at the initial defer/reply in discord.js v14. Now defers ephemerally up front so both the stats embed and any error message stay private, appropriate for an admin-only command. `/membercount` also dropped a stale v12/v13 `{ dynamic: true }` option from `guild.iconURL()` that discord.js v14 silently ignores, so animated server icons weren't getting a `.gif` URL. Both found while typing `slashCommands/settings` in the `slashCommands/` PR, fixed separately.
- `/github` and `/shorten` had the same dead-ephemeral-flag bug as `/database`, but their success replies are meant to be public/shareable, so instead of deferring ephemerally, the fix drops the flag from their error replies too, matching the existing (already public) success path. Found while typing `slashCommands/info` and `slashCommands/utility`, fixed separately.
- Ticket cooldown races, case number reuse, and duplicate duration formatting bugs found during the dashboard's Vitest/ESLint setup and its server-action test coverage.
- Two duplicate reactions crossing the star threshold at nearly the same time could both post the message to the starboard channel. `StarboardSchema`'s `{guildId, messageId}` index is now `unique`, and the handler cleans up its own duplicate post if it loses the race.
- Concurrent poll votes could silently drop a voter: the handler read the vote map, mutated it in memory, and saved the whole document, so two votes landing close together could overwrite each other. Rewritten to use atomic `$pull`/`$addToSet` updates, the same pattern already used by giveaways and suggestions.
- A fast double-click on a blackjack hit/stand/double button could process the same turn twice (double-draw, double-credit). `BlackjackSchema` gained a `processing` lock claimed atomically before every action and released once it completes.
- README's Dependencies table listed `moment` and `outdent`, neither of which is in `package.json` anymore. `dashboard/README.md` documented the Mongo connection variable as `MONGODB_URI`; the actual variable used everywhere is `MONGODB_URL`.

### Notes

Also includes full test coverage for `events/` and `slashCommands/`, and a Vitest and ESLint setup for the dashboard covering its server actions.

[Unreleased]: https://github.com/ckagias/discord-bot/compare/v1.0.5...HEAD
[1.0.5]: https://github.com/ckagias/discord-bot/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/ckagias/discord-bot/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/ckagias/discord-bot/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/ckagias/discord-bot/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/ckagias/discord-bot/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/ckagias/discord-bot/releases/tag/v1.0.0
