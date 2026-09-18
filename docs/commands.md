# Commands Reference

Every slash command, grouped by `slashCommands/` subfolder. This lists what exists and where to find it. For user-facing syntax and examples, see `README.md`'s Commands section or run `/help` and `/commands` in Discord.

## Economy (`slashCommands/economy/`)

`balance`, `daily`, `eco` (admin), `economyleaderboard`, `inventory`, `rob`, `shop`, `shopmanage` (admin), `transfer`, `work`

Backed by `EconomySchema` (balance + cooldowns), `ShopSchema`, `InventorySchema`.

## Fun (`slashCommands/fun/`)

`8ball`, `dare`, `poll`, `pollend`, `truth`

Polls backed by `PollSchema`.

## Info (`slashCommands/info/`)

`avatar`, `botstats`, `commands`, `github`, `help`, `invite`, `link`, `ping`, `profile`, `server`, `userinfo`, `weather`

`weather` requires `WEATHER_API_KEY`. `github` uses `GITHUB_TOKEN`.

## Leveling (`slashCommands/leveling/`)

`leaderboard`, `level`, `levelchannel` (admin), `levelrole` (admin), `toggleleveling` (admin)

Backed by `LevelSchema` (XP/level per user) and `MessageActivitySchema` (daily message counts).

## Minigames (`slashCommands/minigames/`)

`blackjack`, `coinflip`, `gamble`, `hangman`, `heist`, `rps`, `trivia`, `wordle`

Backed by `BlackjackSchema`, `HangmanSchema`, `HeistSchema`, `WordleSchema`, each holds in-progress game state keyed by message/user.

## Moderation (`slashCommands/moderation/`)

`addtrigger`, `antiraid`, `automod`, `ban`, `birthdayconfig`, `case`, `clearwarnings`, `farewell`, `kick`, `lockdown`, `log`, `mute`, `removetrigger`, `setmuterole`, `timeout`, `triggers`, `unban`, `unmute`, `warn`, `warnings`, `warnthreshold`, `welcome`

Every command in this category is permission-gated (`setDefaultMemberPermissions`). None are open to regular members by default.

Backed by `CaseSchema`, `WarnSchema`, `PunishmentSchema` (timed mutes/bans), `TriggerSchema`, `BirthdaySchema`, and the automod/anti-raid config fields on `GuildSchema`. See `README.md` Highlights for the moderation feature summary (role hierarchy checks, bot capability guards, permission checks on every command).

## Music (`slashCommands/music/`)

`loop`, `lyrics`, `nowplaying`, `pause`, `play`, `queue`, `remove`, `resume`, `shuffle`, `skip`, `skipto`, `stop`, `volume`

Runs through `handlers/lavalinkHandler.ts` and `utils/musicPersistence.ts`. See [Music & Lavalink](music-lavalink.md).

## Roles (`slashCommands/roles/`)

`autorole` (admin), `reactionrole` (admin)

Backed by `ReactionRoleSchema`.

## Settings (`slashCommands/settings/`)

`database` (admin), `membercount`, `starboard` (admin)

`starboard` backed by `StarboardSchema`.

## Tickets (`slashCommands/tickets/`)

`ticket` (setup, panel, close, stats, reset subcommands)

Backed by `TicketSchema`. Button-driven, see `handlers/components/` for the interaction logic, and `handlers/eventHandler.ts`/`interactionCreate.ts` for dispatch. The bot needs an explicit permission overwrite on ticket channels to post in them.

## Utility (`slashCommands/utility/`)

`afk`, `birthday`, `embed` (admin), `giveaway`, `purge`, `remind`, `shorten`, `slowmode`, `snipe`, `suggest`, `tempvc`

Backed by `AfkSchema`, `BirthdaySchema`, `GiveawaySchema`, `ReminderSchema`, `SuggestionSchema`, `TempVCSchema`. `giveaway` end/reroll and `suggest` status changes can also be triggered from the dashboard via the [Internal API](internal-api.md).

---

"(admin)" marks commands gated with `setDefaultMemberPermissions`, see `CONTRIBUTING.md`'s "Adding a Command" section for how permission gates are implemented. Gating is set per-command, not globally.
