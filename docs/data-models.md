# Data Models

25 Mongoose schemas in `models/`. Field lists here are a summary. Read the schema file for exact types/defaults when writing code against one.

| Schema | Purpose |
|---|---|
| `AfkSchema` | User AFK status (userId, guildId, reason, since) |
| `BirthdaySchema` | User birthdays (month/day/year, lastAnnounced year to dedupe announcement posts) |
| `BlackjackSchema` | Active blackjack game state per message (deck, playerHand, bet) |
| `CaseSchema` | Moderation case log entries (caseId, type, userId, moderatorId, reason), what `/case` reads |
| `EconomySchema` | Per-user balance + cooldown timestamps (lastDailyAt/lastWorkAt/lastRobAt) |
| `GiveawaySchema` | Giveaway posts (host, prize, winnerCount, entrants, winners) |
| `GuildSchema` | **Central per-guild config document.** Logging channels, welcome/farewell, mute role, tickets, automod settings, warn thresholds, level roles, autorole, starboard, anti-raid, etc. Read/written from both the bot and the dashboard. |
| `HangmanSchema` | Active hangman game state (word, guessed letters, wrong count) |
| `HeistSchema` | Active heist minigame (leader, entry fee, members) |
| `InventorySchema` | User-owned economy shop items (itemId, type, emoji, acquiredAt) |
| `LavalinkSessionSchema` | Lavalink node session id, keyed by `nodeId` (unique), backs session-resume, see [Music & Lavalink](music-lavalink.md) |
| `LevelSchema` | Per-user XP/level (xp, level, lastXpAt) |
| `MessageActivitySchema` | Daily per-guild message counts (guildId, date, count) |
| `MusicPlayerSchema` | Persisted player state per guild (nodeId, voiceChannelId, textChannelId, selfDeaf/selfMute, requesterId), used to restore players after a bot restart |
| `MusicQueueSchema` | Serialized queue data per guild (guildId unique, data: string), backs the custom `MongoQueueStore` |
| `PollSchema` | Poll posts (question, options, host) |
| `PunishmentSchema` | Active timed punishments (type mute/ban, expiresAt, muteRoleId), scheduled expiry |
| `ReactionRoleSchema` | Emoji-to-role mappings per message |
| `ReminderSchema` | User reminders (message, remindAt, sent flag) |
| `ShopSchema` | Guild economy shop items for sale (price, type role/badge) |
| `StarboardSchema` | Starred message tracking (original message + posted starboard message, starCount) |
| `SuggestionSchema` | Suggestion posts with status workflow (pending/approved/denied/implemented) |
| `TempVCSchema` | Temporary voice channels (channelId unique, ownerId) |
| `TicketSchema` | Support tickets (ticketNumber, status open/closed) |
| `TriggerSchema` | Custom auto-response triggers (trigger text → response) |
| `WarnSchema` | Moderation warnings (moderatorId, reason, createdAt) |
| `WordleSchema` | Daily wordle game state per user (date, guesses, won/finished) |

## Notes

- **`GuildSchema` is the exception to "one schema, one concern."** It's a single large document holding most per-guild settings because nearly every feature needs guild config on every interaction, and the [guild config cache](architecture.md#guild-config-caching) is built around caching one document per guild rather than joining several.
- Game-state schemas (`BlackjackSchema`, `HangmanSchema`, `HeistSchema`, `WordleSchema`) hold *transient* state. They exist so an in-progress game survives a bot restart, not as permanent history.
- `dashboard/lib/models/` holds a parallel set of model definitions used by the dashboard's own Mongo client, see [Dashboard](dashboard.md). Keep field shapes in sync manually. There's no shared package between bot and dashboard for this.
- New models should follow the pattern in `CONTRIBUTING.md`'s "Adding a Mongoose Model" section.
