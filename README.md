# Discord Bot

### A Discord bot built with [discord.js](https://github.com/discordjs/discord.js), Lavalink, and MongoDB

[About](#about) • [Features](#features) • [Highlights](#highlights) • [Commands](#commands) • [Installation](#installation) • [Dashboard](#dashboard) • [Dependencies](#dependencies) • [Testing](#testing) • [Contributing](#contributing) • [Security](#security) • [License](#license)

---

## About

An open-source Discord bot with slash commands organized by category, XP leveling, music playback via Lavalink, and MongoDB data storage.

If you find this useful, consider leaving a star.

---

## Features

**85+** commands across **10** categories:

- **Fun:** `8ball`, `dare`, `truth`, `poll`, `pollend`
- **Info:** `avatar`, `help`, `commands`, `weather`, `github` and 10 more
- **Leveling:** `leaderboard`, `level`, `toggleleveling`, `levelrole`, `levelchannel`
- **Music:** `play`, `skip`, `pause`, `resume`, `stop` and 8 more
- **Utility:** `purge`, `shorten`, `afk`, `slowmode`, `snipe` and 4 more
- **Moderation:** `kick`, `ban`, `timeout`, `mute`, `warn` and 31 more
- **Minigames:** `gamble`, `coinflip`, `rps`, `wordle`, `trivia` and 3 more
- **Economy:** `balance`, `daily`, `work`, `rob`, `transfer` and 4 more
- **Tickets:** `ticket setup`, `ticket panel`, `ticket close`, `ticket stats`, `ticket reset`
- **Roles:** `reactionrole setup`, `reactionrole add`, `reactionrole remove`, `reactionrole list`

### Highlights

**Moderation:** Role hierarchy checks, bot capability guards, and runtime permission checks on every command. Every action is logged as a numbered case, viewable via `/case` or the dashboard. Auto-moderation covers banned words, spam, mentions, and invite links with configurable actions and exemptions.

**Anti-raid:** Detects join-rate spikes, quarantines new joiners, and alerts staff. Configurable thresholds, survives restarts.

**Mutes and bans:** Mutes hold via channel-level overwrites regardless of other roles. Temporary bans lift automatically. A keyword trigger system replies automatically (Unicode-safe). A server event logger tracks edits, deletes, joins, leaves, and role changes.

**Economy and minigames:** Passive earnings, daily streaks, `/work`, `/rob`, transfers, and admin tools. Minigames (gamble, coinflip, rps, wordle, trivia, hangman, blackjack, heist) pay out real credits, with PvP challenges and a multiplayer heist. A per-server shop sells role or badge items.

**Leveling:** Persistent XP with atomic writes. Admins map levels to roles, granted automatically on level-up. Top-20 leaderboard in the dashboard.

**Community tools:** Tickets, starboard, reaction roles, giveaways, welcome/farewell messages, autorole, temp voice channels, a two-step embed builder, and personal reminders.

**Infrastructure:** AFK detection, Docker support with Lavalink and MongoDB, graceful shutdown for clean restarts.

---

## Commands

### Fun

| Command    | Description                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| `/8ball`   | Ask a question and get a random answer                                                                |
| `/dare`    | Get a random dare                                                                                     |
| `/truth`   | Get a random truth question                                                                           |
| `/poll`    | Create a poll with up to 4 options, button voting, live result bars, and optional auto-close duration |
| `/pollend` | End an active poll early (poll creator or Manage Server)                                              |

### Info

| Command          | Description                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/avatar global` | Show a user's global avatar                                                                                                      |
| `/avatar server` | Show a user's server-specific avatar                                                                                             |
| `/server info`   | Display detailed server information                                                                                              |
| `/userinfo`      | Display detailed user info including status, activity, voice state, device, nickname, boosting, join position, badges, and roles |
| `/ping`          | Show the bot's latency and API ping                                                                                              |
| `/help`          | Show bot info and point to `/commands`, `/botstats`, and `/link`                                                                 |
| `/commands`      | List all available commands by category                                                                                          |
| `/weather`       | Show the current weather for a city                                                                                              |
| `/github`        | Show GitHub profile, repository stats, yearly contribution count, and contribution chart for a user                              |
| `/invite`        | Generate a 7-day invite link for the current server                                                                              |
| `/link`          | Generate an invite link to add the bot to another server                                                                         |
| `/botstats`      | Show bot performance, system/stack info, and feature overview                                                                    |
| `/server icon`   | Show the server's icon with download links                                                                                       |
| `/server banner` | Show the server's banner with download links (requires server boost level 2+)                                                    |
| `/profile`       | View a member's server profile: level, balance, warnings, join date, account age, and badges                                     |

### Leveling

| Command               | Description                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `/level check`        | Check your or another user's current level and XP (disabled if leveling is off)             |
| `/level set`          | Set a member's level, reset their XP to 0, and grant all earned level roles (Manage Server) |
| `/leaderboard`        | Display the server's top 10 leaderboard                                                     |
| `/toggleleveling`     | Enable or disable the XP system for this server (Admin only)                                |
| `/levelrole set`      | Assign a role to be granted when a member reaches a level (Manage Server)                   |
| `/levelrole remove`   | Remove the level role mapping at a specific level (Manage Server)                           |
| `/levelrole list`     | Show all configured level role mappings for this server (Manage Server)                     |
| `/levelchannel set`   | Set a dedicated channel where level-up announcements are posted (Manage Server)             |
| `/levelchannel reset` | Remove the dedicated level-up channel (announcements post in the active channel)            |

### Music

| Command       | Description                                               |
| ------------- | --------------------------------------------------------- |
| `/play`       | Play a song or playlist from YouTube, SoundCloud, Spotify |
| `/skip`       | Skip the current track                                    |
| `/pause`      | Pause the current track                                   |
| `/resume`     | Resume playback                                           |
| `/stop`       | Stop playback and clear the queue                         |
| `/queue`      | Show the current queue                                    |
| `/nowplaying` | Show details about the currently playing track            |
| `/lyrics`     | Show lyrics for the currently playing song                |
| `/skipto`     | Skip to a specific position in the queue                  |
| `/remove`     | Remove a track from the queue by position                 |
| `/shuffle`    | Shuffle the upcoming tracks in the queue                  |
| `/loop`       | Set loop mode (off, track, queue)                         |
| `/volume`     | Set or check the playback volume                          |

### Utility

| Command            | Description                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `/afk`             | Set your AFK status (the bot notifies anyone who mentions you)                                                                |
| `/purge`           | Delete messages from a channel, optionally filter by user, bots only, text content, or attachments (requires Manage Messages) |
| `/shorten`         | Shorten a URL using is.gd                                                                                                     |
| `/slowmode`        | Set the slowmode delay for a channel (requires Manage Channels)                                                               |
| `/tempvc setup`    | Set the category where temp VCs are created (Manage Server, also configurable via dashboard)                                  |
| `/tempvc create`   | Create a temporary voice channel that auto-deletes when empty, with a Rename / Lock / Set Limit control panel for the owner   |
| `/tempvc invite`   | Invite a user to your locked temp VC (owner only)                                                                             |
| `/snipe delete`    | Show the last deleted message in the current channel                                                                          |
| `/snipe edit`      | Show the last edited message (before/after) in this channel                                                                   |
| `/giveaway start`  | Start a timed giveaway with a prize, duration, optional winner count, and optional role requirement (Manage Server)           |
| `/giveaway end`    | End an active giveaway early and pick winners immediately (Manage Server)                                                     |
| `/giveaway reroll` | Reroll winners for an ended giveaway (Manage Server)                                                                          |
| `/giveaway list`   | List all active giveaways in this server with time remaining and jump links (Manage Server)                                   |
| `/embed create`    | Build and post a custom embed via a two-step modal (main fields + optional fields) (Manage Messages)                          |
| `/embed edit`      | Edit an existing embed posted by the bot, pre-filled with current values (Manage Messages)                                    |
| `/embed help`      | Show an in-Discord formatting reference for markdown, links, mentions, and timestamps                                         |
| `/remind set`      | Set a personal reminder with a duration and message, persisting across bot restarts                                           |
| `/remind list`     | List your active reminders                                                                                                    |
| `/remind cancel`   | Cancel one of your active reminders by ID                                                                                     |

### Minigames

| Command          | Description                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/gamble`        | Bet credits on a high-low roll, win or lose real balance                                                                                                     |
| `/coinflip`      | Flip a coin, optionally betting credits, or challenge another player with `/coinflip opponent`                                                               |
| `/rps`           | Play Rock Paper Scissors against the bot or challenge another player, optionally with a bet                                                                  |
| `/wordle guess`  | Submit a 5-letter guess for today's official NYT Wordle, earn up to 500 coins for a win, 25 for a loss                                                       |
| `/wordle status` | View your current Wordle board for today                                                                                                                     |
| `/trivia`        | Answer a multiple-choice trivia question from Open Trivia DB, earn 50 / 100 / 200 coins for easy / medium / hard                                             |
| `/hangman`       | Guess a hidden word letter by letter via a modal, earn 150 coins for solving it                                                                              |
| `/blackjack`     | Play Blackjack against the dealer with Hit / Stand / Double Down, or challenge another player with `/blackjack opponent`                                     |
| `/heist`         | Organize a crew heist: players pay an entry fee to join, loot is multiplied and split among survivors. Organizer can start early once 2+ members have joined |

### Economy

| Command               | Description                                                                             |
| --------------------- | --------------------------------------------------------------------------------------- |
| `/balance`            | Check your or another user's credit balance                                             |
| `/daily`              | Claim daily credits with a streak bonus, up to 3.5× base on day 7+ (24h cooldown)       |
| `/work`               | Work a random job and earn 50–450 credits (1-hour cooldown)                             |
| `/rob`                | Attempt to steal credits from a member, 45% success rate, fine on failure (1h cooldown) |
| `/transfer`           | Transfer credits to another member                                                      |
| `/economyleaderboard` | Show the top 10 richest members in this server                                          |
| `/eco give`           | Give credits to a member (Manage Server)                                                |
| `/eco take`           | Remove credits from a member (Manage Server)                                            |
| `/eco set`            | Set a member's balance to an exact amount (Manage Server)                               |
| `/eco reset`          | Reset a member's balance, streak, and cooldowns (Manage Server)                         |
| `/shop browse`        | Browse all available items in the server shop                                           |
| `/shop buy`           | Buy an item from the shop (autocomplete), role items grant the role immediately         |
| `/shop sell`          | Sell an owned item back for 50% of its original price, role items are revoked on sell   |
| `/inventory`          | View your owned shop items, paginated (5 per page)                                      |
| `/shopmanage add`     | Add a role or badge item to the shop (Manage Server)                                    |
| `/shopmanage remove`  | Remove an item from the shop, existing owners keep it (Manage Server)                   |
| `/shopmanage edit`    | Edit an item's name, price, description, or visibility (Manage Server)                  |
| `/shopmanage list`    | List all shop items including hidden ones (Manage Server)                               |

### Moderation

| Command                 | Description                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/kick`                 | Kick a member from the server (Kick Members)                                                                       |
| `/ban`                  | Ban a member from the server with optional duration and message deletion (Ban Members)                             |
| `/unban`                | Unban a user by ID (Ban Members)                                                                                   |
| `/timeout add`          | Timeout a member for a set duration (Moderate Members)                                                             |
| `/timeout edit`         | Change the duration of a member's active timeout (Moderate Members)                                                |
| `/timeout remove`       | Remove an active timeout from a member (Moderate Members)                                                          |
| `/mute`                 | Mute a member using the configured mute role, with optional duration (Moderate Members)                            |
| `/unmute`               | Unmute a member by removing the mute role (Moderate Members)                                                       |
| `/setmuterole`          | Set the role to assign when a member is muted (Manage Server)                                                      |
| `/warn`                 | Issue a warning to a member (Moderate Members)                                                                     |
| `/warnings`             | View all warnings for a member (Moderate Members)                                                                  |
| `/clearwarnings`        | Clear all warnings for a member (Moderate Members)                                                                 |
| `/warnthreshold set`    | Add or update an automatic punishment (timeout, kick, or ban) at a warning count (Manage Server)                   |
| `/warnthreshold remove` | Remove the threshold at a specific warning count (Manage Server)                                                   |
| `/warnthreshold list`   | Show all configured warn thresholds for this server (Manage Server)                                                |
| `/case lookup`          | View a specific moderation case by its ID (Moderate Members)                                                       |
| `/case history`         | View the last 10 cases against a user (Moderate Members)                                                           |
| `/case delete`          | Delete a case by ID (Moderate Members)                                                                             |
| `/addtrigger`           | Add a keyword and the bot's response to it (Manage Messages)                                                       |
| `/removetrigger`        | Remove a trigger keyword (Manage Messages)                                                                         |
| `/triggers`             | List all trigger keywords configured for this server                                                               |
| `/log set`              | Set the channel where server events will be logged (Manage Server)                                                 |
| `/log unset`            | Disable event logging for this server (Manage Server)                                                              |
| `/welcome set`          | Set the channel and optional message for member join announcements (Manage Server)                                 |
| `/welcome unset`        | Disable welcome messages for this server (Manage Server)                                                           |
| `/farewell set`         | Set the channel and optional message for member leave announcements (Manage Server)                                |
| `/farewell unset`       | Disable farewell messages for this server (Manage Server)                                                          |
| `/lockdown lock`        | Prevent everyone from sending messages in the current channel, with an optional reason (Manage Channels)           |
| `/lockdown remove`      | Restore normal messaging permissions in the current channel (Manage Channels)                                      |
| `/antiraid setrole`     | Set the quarantine role assigned to new members during a lockdown, applying overwrites immediately (Manage Server) |
| `/antiraid lock`        | Manually activate a raid lockdown, quarantining new joiners until unlocked (Manage Server)                         |
| `/antiraid unlock`      | Lift an active lockdown, already-quarantined members remain held (Manage Server)                                   |
| `/antiraid release`     | Remove the quarantine role from a specific member (false-positive recovery) (Manage Server)                        |
| `/antiraid config`      | Set the join threshold, time window, and enable/disable automatic detection (Manage Server)                        |
| `/antiraid status`      | Show current anti-raid config: role, thresholds, lockdown state, and start time (Manage Server)                    |
| `/automod toggle`       | Enable or disable auto-moderation entirely (Manage Server)                                                         |
| `/automod filter`       | Toggle an individual filter: banned words, spam/flood, mentions, or invite links (Manage Server)                   |
| `/automod action`       | Set the action taken on a filtered message: delete only, delete + warn, or delete + timeout (Manage Server)        |
| `/automod mentionlimit` | Set the max mentions allowed per message before the mentions filter triggers (Manage Server)                       |
| `/automod word add`     | Add a word to the banned word list (Manage Server)                                                                 |
| `/automod word remove`  | Remove a word from the banned word list (Manage Server)                                                            |
| `/automod word list`    | List all banned words (Manage Server)                                                                              |
| `/automod view`         | View the current auto-moderation configuration (Manage Server)                                                     |

### Tickets

| Command         | Description                                                                    |
| --------------- | ------------------------------------------------------------------------------ |
| `/ticket setup` | Set the category and support role for the ticket system (Manage Server)        |
| `/ticket panel` | Post the ticket panel embed with an Open Ticket button in the current channel  |
| `/ticket close` | Close the current ticket channel (usable by the ticket owner or support staff) |
| `/ticket stats` | Show total, open, and closed ticket counts for this server (Manage Server)     |
| `/ticket reset` | Reset the ticket counter to 0 and clear all ticket records (Administrator)     |

### Roles

| Command                | Description                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `/reactionrole setup`  | Open a form to customize and post a reaction role embed (title, description, color, footer, thumbnail) |
| `/reactionrole add`    | Bind an emoji on a message to a role (bot reacts automatically)                                        |
| `/reactionrole remove` | Remove an emoji role from a message                                                                    |
| `/reactionrole list`   | List all reaction role bindings configured for this server                                             |
| `/autorole set`        | Set the role to assign to every new member on join                                                     |
| `/autorole remove`     | Disable autorole                                                                                       |
| `/autorole view`       | Show the current autorole setting                                                                      |

### Settings

| Command        | Description                              |
| -------------- | ---------------------------------------- |
| `/database`    | Show database storage stats (Admin only) |
| `/membercount` | Show the server's member count           |

---

## Installation

### Requirements

- Node.js 22 or later
- Docker and Docker Compose (Option A), or a local MongoDB and Lavalink server (Option B)
- Linux or macOS for the `.sh` scripts and `npm run restart`. On Windows, run them from WSL or Git Bash. `npm start` and `npm run stop` work in any shell since they call `docker compose` directly.

### Option A: Docker (recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/ckagias/discord-bot.git
   cd discord-bot
   ```
2. **Create a `.env` file**
   ```env
   Token=your_discord_bot_token
   ClientID=your_discord_application_id
   MONGODB_URL=mongodb://mongodb:27017/discordbot
   WEATHER_API_KEY=your_openweathermap_api_key
   GITHUB_TOKEN=your_github_token
   ```
3. **Start the bot:** `npm start` or `./start.sh`
4. **Stop the bot:** `npm run stop` or `./stop.sh`
5. **After adding or changing code:** `npm run restart` or `./restart.sh`

### Option B: Manual

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/ckagias/discord-bot.git
   cd discord-bot
   npm install
   ```
2. **Create a `.env` file**
   ```env
   Token=your_discord_bot_token
   ClientID=your_discord_application_id
   MONGODB_URL=your_mongodb_connection_string
   LAVALINK_HOST=127.0.0.1
   LAVALINK_PORT=2333
   LAVALINK_PASSWORD=youshallnotpass
   WEATHER_API_KEY=your_openweathermap_api_key
   GITHUB_TOKEN=your_github_token
   ```
3. **Start a Lavalink server** (see [lavalink-devs/Lavalink](https://github.com/lavalink-devs/Lavalink) for setup)
4. **Register slash commands:** `node src/cmd.js`
5. **Start the bot:** `node src/index.js`

If you ever see duplicate or leftover guild-specific commands (e.g. from earlier testing), clear them with:

```bash
node src/clean.js <guildId>
```

#### Where to get your keys

- Bot token and Client ID: [https://discord.com/developers/applications](https://discord.com/developers/applications)
- Weather API key: [https://home.openweathermap.org/api_keys](https://home.openweathermap.org/api_keys)
- MongoDB URL: [https://cloud.mongodb.com](https://cloud.mongodb.com)
- GitHub token: [https://github.com/settings/tokens](https://github.com/settings/tokens)

#### All environment variables

See `.env.example` for the full list with inline comments. Summary:

| Variable                                                | Required            | Description                                                                                                                                                 |
| ------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Token`                                                 | Yes                 | Discord bot token                                                                                                                                           |
| `ClientID`                                              | Yes                 | Discord application client ID                                                                                                                               |
| `MONGODB_URL`                                           | Yes                 | MongoDB connection string                                                                                                                                   |
| `WEATHER_API_KEY`                                       | No                  | Powers `/weather`. Without it the command fails                                                                                                             |
| `GITHUB_TOKEN`                                          | No                  | Powers `/github`. Without it, calls fall back to unauthenticated, rate-limited GitHub API access                                                            |
| `BOT_ACTIVITY_NAME`                                     | No                  | Text shown in the bot's Discord status                                                                                                                      |
| `BOT_ACTIVITY_TYPE`                                     | No                  | Activity type for the status (e.g. `Watching`, `Playing`, `Listening`). Defaults to `Watching`                                                              |
| `LAVALINK_HOST` / `LAVALINK_PORT` / `LAVALINK_PASSWORD` | Manual install only | Lavalink connection details. Docker sets these for you                                                                                                      |
| `CLIENT_SECRET` / `SESSION_SECRET` / `DASHBOARD_URL`    | Dashboard only      | See [Dashboard](#dashboard)                                                                                                                                 |
| `INTERNAL_API_PORT` / `INTERNAL_API_SECRET`             | Dashboard only      | Internal HTTP bridge the dashboard uses to trigger giveaway end/reroll on the bot. Without `INTERNAL_API_SECRET` set, those dashboard buttons silently fail |

---

## Dashboard

An optional self-hosted web dashboard (`[dashboard/](dashboard)`) lets you manage your server's bot settings from the browser. It's built with Next.js, runs as an additional Docker Compose service, and shares the bot's MongoDB database. There's no centralized backend. Every self-hoster's dashboard is fully isolated to their own stack.

Sign in with Discord OAuth2, pick a server where you have Manage Server and the bot is present, and manage settings from a sidebar of independently-saved sections:

| Section             | What you can manage                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| General             | Log channel                                                                                        |
| Welcome & Farewell  | Join/leave channels and messages                                                                   |
| Moderation          | Mute role, autorole                                                                                |
| Auto-Mod            | Filters, action, banned word list                                                                  |
| Anti-Raid           | Quarantine role, alert channel, join threshold/window, auto-detection toggle, live lockdown status |
| Warn Thresholds     | Auto-escalation rules                                                                              |
| Warnings            | Full warning history, filterable by user ID, with per-warning deletion                             |
| Leveling            | Enable toggle, level-up channel, level→role mappings, top-20 XP leaderboard                        |
| Starboard           | Channel, emoji, threshold, NSFW exclusion                                                          |
| Reaction Roles      | Add/remove emoji→role bindings per message                                                         |
| Triggers            | Keyword→response pairs                                                                             |
| Case Log            | Full mod action history, filterable by user ID, with per-case deletion                             |
| Economy             | Credit leaderboard                                                                                 |
| Shop                | Add/edit/remove role and badge items with price, description, visibility                           |
| Tickets             | Category and support role setup, plus a live ticket list with open/closed filter                   |
| Temp Voice Channels | Auto-VC channel and category                                                                       |
| Giveaways           | Active giveaways with an End button, past giveaways with Reroll and Delete buttons                 |

### Enabling it

1. In your `.env`, fill in the dashboard-specific variables (see `.env.example`):
   ```env
   CLIENT_SECRET=your_discord_application_client_secret
   SESSION_SECRET=a_long_random_string_at_least_32_chars
   DASHBOARD_URL=http://localhost:3000
   INTERNAL_API_SECRET=a_long_random_secret_shared_with_the_dashboard
   ```
   `CLIENT_SECRET` is found on the same [Discord Developer Portal](https://discord.com/developers/applications) page as your bot token and Client ID, under OAuth2. `INTERNAL_API_SECRET` is required for the dashboard's giveaway End and Reroll buttons. Without it those requests are rejected.
2. In the Discord Developer Portal, under your application's **OAuth2** settings, add a redirect:
   ```
   http://localhost:3000/api/auth/callback
   ```
   (replace with your `DASHBOARD_URL` if different, e.g. when deploying behind a domain)
3. Start everything with `npm start` or `./start.sh` as usual. The `dashboard` service starts alongside `bot`, `mongodb`, and `lavalink`, and is reachable at `http://localhost:3000`.

The dashboard is entirely optional. The bot runs fine standalone if you never set these variables or visit the dashboard URL.

---

## Dependencies

| Package                                                          | Purpose                                             |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| [discord.js](https://discord.js.org/)                            | Core Discord library                                |
| [lavalink-client](https://github.com/Tomato6966/lavalink-client) | Lavalink v4 client for music                        |
| [mongoose](https://mongoosejs.com/)                              | MongoDB object modeling                             |
| [axios](https://axios-http.com/)                                 | HTTP requests (weather, GitHub APIs)                |
| [@resvg/resvg-js](https://github.com/yisibl/resvg-js)            | SVG to PNG conversion for GitHub contribution chart |
| [moment](https://momentjs.com/)                                  | Date/time formatting                                |
| [outdent](https://www.npmjs.com/package/outdent)                 | Multi-line string formatting                        |
| [dotenv](https://www.npmjs.com/package/dotenv)                   | Loads environment variables from `.env`             |

---

## Testing

Run `npm test` to run the test suite (Jest).

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started. Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for how to report it privately.

---

## License

This project is licensed under the [MIT License](LICENSE).