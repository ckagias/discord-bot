# Discord Bot

### A Discord bot built with [discord.js](https://github.com/discordjs/discord.js), Lavalink, and MongoDB

[About](#about) • [Features](#features) • [Commands](#commands) • [Installation](#installation) • [Dependencies](#dependencies) • [License](#license)

---

## About

An open-source Discord bot with slash commands organized by category, persistent XP leveling, music playback via Lavalink, and MongoDB-backed data storage.

If you find this useful, feel free to leave a ⭐ to help others find it!

---

## Features

**60+** commands across **8** categories:

- 🎉 **Fun:** `8ball`, `dare`, `truth`, `gayrate`, `poll`
- ℹ️ **Info:** `avatar`, `help`, `commands`, `weather`, `github` and **9** more.
- ⏫ **Leveling:** `leaderboard`, `level`, `toggleleveling`
- 🎵 **Music:** `play`, `skip`, `pause`, `resume`, `stop` and **4** more.
- 🔧 **Utility:** `purge`, `shorten`, `afk`, `slowmode`, `snipe` and **3** more.
- 🛡️ **Moderation:** `kick`, `ban`, `timeout`, `mute`, `warn` and **14** more.
- 🎮 **Minigames:** `gamble`, `coinflip`, `rps`
- 🎫 **Tickets:** `ticket setup`, `ticket panel`, `ticket close`, `ticket stats`, `ticket reset`
- 🏷️ **Roles:** `reactionrole setup`, `reactionrole add`, `reactionrole remove`, `reactionrole list`

Other highlights:

- Full moderation suite with role hierarchy checks, bot capability guards, and runtime permission checks on every command
- Trigger system: server admins configure keyword and the response for that word, bot replies when the word appears standalone in a message (Unicode-safe, works with Greek and other non-ASCII languages)
- Mute system using a configurable muted role with automatic channel-level permission overwrites so the mute holds regardless of other roles
- Server event logger that logs message deletes/edits, joins, leaves, kicks, bans, nickname changes, role updates, and voice activity to a configurable channel
- Welcome/farewell messages, configurable per-server with custom messages supporting `{user}` and `{server}` placeholders
- Persistent XP leveling per server with atomic writes
- AFK system with return detection and mention notifications
- Ticket system with private channels, support role pinging, auto-cleanup of stale tickets, and per-server stats
- Reaction roles with support for unicode and custom/animated emojis, bound per message and stored in MongoDB
- Giveaway system with button-based entry, live entrant count, configurable winner count, and MongoDB persistence so active giveaways survive bot restarts
- Temporary voice channels with optional locking, user limit, and invite-only access
- Custom embed builder with a two-step modal flow. Main fields (title, description, color, footer, image) then optional inline or full-width fields, plus an in-Discord formatting reference
- Docker support with Lavalink and MongoDB services included
- Graceful shutdown handling for clean Docker restarts

---

## Commands

### 🎉 Fun


| Command    | Description                                            |
| ---------- | ------------------------------------------------------ |
| `/8ball`   | Ask a question and get a random answer                 |
| `/dare`    | Get a random dare                                      |
| `/truth`   | Get a random truth question                            |
| `/gayrate` | Rate how gay a user is                                 |
| `/poll`    | Create a poll with up to 4 options and reaction voting |


### ℹ️ Info


| Command          | Description                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/avatar global` | Show a user's global avatar                                                                                                      |
| `/avatar server` | Show a user's server-specific avatar                                                                                             |
| `/server info`   | Display detailed server information                                                                                              |
| `/userinfo`      | Display detailed user info including status, activity, voice state, device, nickname, boosting, join position, badges, and roles |
| `/ping`          | Show the bot's latency and API ping                                                                                              |
| `/uptime`        | Show how long the bot has been online                                                                                            |
| `/help`          | Show bot info and system stats                                                                                                   |
| `/commands`      | List all available commands by category                                                                                          |
| `/weather`       | Show the current weather for a city                                                                                              |
| `/github`        | Show GitHub profile, repository stats, yearly contribution count, and contribution chart for a user                              |
| `/invite`        | Generate a 7-day invite link for the current server                                                                              |
| `/link`          | Generate an invite link to add the bot to another server                                                                         |
| `/botstats`      | Show bot performance stats, feature overview, and total command count                                                            |
| `/server icon`   | Show the server's icon with download links                                                                                       |
| `/server banner` | Show the server's banner with download links (requires server boost level 2+)                                                    |


### ⏫ Leveling


| Command           | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `/level`          | Check your or another user's current level and XP            |
| `/leaderboard`    | Display the server's top 10 leaderboard                      |
| `/toggleleveling` | Enable or disable the XP system for this server (Admin only) |


### 🎵 Music


| Command       | Description                                                |
| ------------- | ---------------------------------------------------------- |
| `/play`       | Play a song or playlist from YouTube, SoundCloud, and more |
| `/skip`       | Skip the current track                                     |
| `/pause`      | Pause the current track                                    |
| `/resume`     | Resume playback                                            |
| `/stop`       | Stop playback and clear the queue                          |
| `/queue`      | Show the current queue                                     |
| `/nowplaying` | Show details about the currently playing track             |
| `/loop`       | Set loop mode (off, track, queue)                          |
| `/volume`     | Set or check the playback volume                           |


### 🔧 Utility


| Command          | Description                                                                        |
| ---------------- | ---------------------------------------------------------------------------------- |
| `/afk`           | Set your AFK status (the bot notifies anyone who mentions you)                     |
| `/purge`         | Delete a number of messages (requires Manage Messages)                             |
| `/shorten`       | Shorten a URL using is.gd                                                          |
| `/slowmode`      | Set the slowmode delay for a channel (requires Manage Channels)                    |
| `/tempvc create`   | Create a temporary voice channel in your current category; auto-deletes when empty |
| `/tempvc invite`   | Invite a user to your locked temp VC (owner only)                                  |
| `/snipe delete`    | Show the last deleted message in the current channel                               |
| `/snipe edit`      | Show the last edited message (before/after) in this channel                        |
| `/giveaway start`  | Start a timed giveaway with a prize, duration, and optional winner count (Manage Server) |
| `/giveaway end`    | End an active giveaway early and pick winners immediately (Manage Server)          |
| `/giveaway reroll` | Reroll winners for an ended giveaway (Manage Server)                               |
| `/embed create`    | Build and post a custom embed via a two-step modal (main fields + optional fields) (Manage Messages) |
| `/embed edit`      | Edit an existing embed posted by the bot, pre-filled with current values (Manage Messages) |
| `/embed help`      | Show an in-Discord formatting reference for markdown, links, mentions, and timestamps |


### 🎮 Minigames


| Command     | Description                                                     |
| ----------- | --------------------------------------------------------------- |
| `/gamble`   | Bet your credits on a high-low roll                             |
| `/coinflip` | Flip a coin (optionally guess heads or tails)                   |
| `/rps`      | Play Rock Paper Scissors against the bot with a button-based UI |


### 🛡️ Moderation


| Command          | Description                                                                         |
| ---------------- | ----------------------------------------------------------------------------------- |
| `/kick`          | Kick a member from the server (Kick Members)                                        |
| `/ban`           | Ban a member from the server with optional message deletion (Ban Members)           |
| `/unban`         | Unban a user by ID (Ban Members)                                                    |
| `/timeout`       | Temporarily timeout a member for a set duration (Moderate Members)                  |
| `/mute`          | Mute a member using the configured mute role (Moderate Members)                     |
| `/unmute`        | Unmute a member by removing the mute role (Moderate Members)                        |
| `/setmuterole`   | Set the role to assign when a member is muted (Manage Server)                       |
| `/warn`          | Issue a warning to a member (Moderate Members)                                      |
| `/warnings`      | View all warnings for a member (Moderate Members)                                   |
| `/clearwarnings` | Clear all warnings for a member (Moderate Members)                                  |
| `/addtrigger`    | Add a keyword and the bot's response to it (Manage Messages)                        |
| `/removetrigger` | Remove a trigger keyword (Manage Messages)                                          |
| `/triggers`      | List all trigger keywords configured for this server                                |
| `/setlog`        | Set the channel where server events will be logged (Manage Server)                  |
| `/unsetlog`      | Disable event logging for this server (Manage Server)                               |
| `/setwelcome`    | Set the channel and optional message for member join announcements (Manage Server)  |
| `/unsetwelcome`  | Disable welcome messages for this server (Manage Server)                            |
| `/setfarewell`   | Set the channel and optional message for member leave announcements (Manage Server) |
| `/unsetfarewell` | Disable farewell messages for this server (Manage Server)                           |


### 🎫 Tickets


| Command         | Description                                                                    |
| --------------- | ------------------------------------------------------------------------------ |
| `/ticket setup` | Set the category and support role for the ticket system (Manage Server)        |
| `/ticket panel` | Post the ticket panel embed with an Open Ticket button in the current channel  |
| `/ticket close` | Close the current ticket channel (usable by the ticket owner or support staff) |
| `/ticket stats` | Show total, open, and closed ticket counts for this server (Manage Server)     |
| `/ticket reset` | Reset the ticket counter to 0 and clear all ticket records (Administrator)     |


### 🏷️ Roles


| Command                | Description                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `/reactionrole setup`  | Open a form to customize and post a reaction role embed (title, description, color, footer, thumbnail) |
| `/reactionrole add`    | Bind an emoji on a message to a role (bot reacts automatically)                                        |
| `/reactionrole remove` | Remove an emoji role from a message                                                                    |
| `/reactionrole list`   | List all reaction role bindings configured for this server                                             |


### ⚙️ Settings


| Command        | Description                              |
| -------------- | ---------------------------------------- |
| `/database`    | Show database storage stats (Admin only) |
| `/membercount` | Show the server's member count           |


---

## Installation

### Option A — Docker (recommended)

1. **Clone the repository**
  ```bash
   git clone https://github.com/ckagias/Discord-Bot.git
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
3. **Start the bot**:
  ```bash
   npm start
  ```
  ```bash
   ./start.sh
  ```
4. **Stop the bot**:
  ```bash
   npm run stop
  ```
  ```bash
   ./stop.sh
  ```
5. **After adding or changing code** (re-registers commands, rebuilds and restarts):
  ```bash
   npm run restart
  ```
  ```bash
   ./restart.sh
  ```

### Option B — Manual

1. **Clone and install dependencies**
  ```bash
   git clone https://github.com/ckagias/Discord-Bot.git
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
3. **Start a Lavalink server** — see [lavalink-devs/Lavalink](https://github.com/lavalink-devs/Lavalink) for setup
4. **Register slash commands**
  ```bash
   node src/cmd.js
  ```
5. **Start the bot**
  ```bash
   node src/index.js
  ```

#### Where to get your keys

- Bot token and Client ID: [https://discord.com/developers/applications](https://discord.com/developers/applications)
- Weather API key: [https://home.openweathermap.org/api_keys](https://home.openweathermap.org/api_keys)
- MongoDB URL: [https://cloud.mongodb.com](https://cloud.mongodb.com)
- GitHub token: [https://github.com/settings/tokens](https://github.com/settings/tokens)

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

## License

This project is licensed under the [MIT License](LICENSE).