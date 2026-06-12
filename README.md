# Discord Bot

### A Discord bot built with [discord.js](https://github.com/discordjs/discord.js), Lavalink, and MongoDB

[About](#about) • [Features](#features) • [Commands](#commands) • [Installation](#installation) • [Dependencies](#dependencies) • [License](#license)

---

## About

An open-source Discord bot with slash commands organized by category, persistent XP leveling, music playback via Lavalink, and MongoDB-backed data storage.

If you find this useful, feel free to leave a ⭐ to help others find it!

---

## Features

**30+** commands across **7** categories:

- 🎉 **Fun:** `8ball`, `dare`, `truth`, `gayrate`, `poll`
- ℹ️ **Info:** `avatar`, `server-avatar`, `server-info`, `ping`, `uptime`, `help`, `commands`, `weather`, `github`
- ⏫ **Leveling:** `leaderboard`, `level`, `toggleleveling`
- 🎵 **Music:** `play`, `skip`, `pause`, `resume`, `stop`, `queue`, `nowplaying`, `loop`, `volume`
- 🔧 **Utility:** `purge`, `shorten`, `afk`, `slowmode`
- 🛡️ **Moderation:** `setlog`, `unsetlog`
- 🎮 **Minigames:** `gamble`

Other highlights:

- Server event logger — logs message deletes/edits, joins, leaves, kicks, bans, nickname changes, role updates, and voice activity to a configurable channel
- Persistent XP leveling per server with atomic writes
- AFK system with return detection and mention notifications
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


| Command          | Description                                         |
| ---------------- | --------------------------------------------------- |
| `/avatar`        | Show a user's global avatar                         |
| `/server-avatar` | Show a user's server avatar                         |
| `/server-info`   | Display detailed server information                 |
| `/userinfo`      | Display detailed user information                   |
| `/ping`          | Show the bot's latency and API ping                 |
| `/uptime`        | Show how long the bot has been online               |
| `/help`          | Show bot info and system stats                      |
| `/commands`      | List all available commands by category             |
| `/weather`       | Show the current weather for a city                 |
| `/github`        | Show GitHub profile and repository stats for a user |


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


| Command     | Description                                                     |
| ----------- | --------------------------------------------------------------- |
| `/afk`      | Set your AFK status — the bot notifies anyone who mentions you  |
| `/purge`    | Delete a number of messages (requires Manage Messages)          |
| `/shorten`  | Shorten a URL using is.gd                                       |
| `/slowmode` | Set the slowmode delay for a channel (requires Manage Channels) |


### 🎮 Minigames


| Command   | Description                         |
| --------- | ----------------------------------- |
| `/gamble` | Bet your credits on a high-low roll |


### 🛡️ Moderation


| Command      | Description                                                   |
| ------------ | ------------------------------------------------------------- |
| `/setlog`    | Set the channel where server events will be logged (Manage Server) |
| `/unsetlog`  | Disable event logging for this server (Manage Server)         |


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
   git clone https://github.com/your-username/discord-bot.git
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
3. **Start all services**
  ```bash
   docker compose up -d
  ```
4. **Register slash commands**
  ```bash
   docker compose exec bot node src/cmd.js
  ```

### Option B — Manual

1. **Clone and install dependencies**
  ```bash
   git clone https://github.com/your-username/discord-bot.git
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


| Package                                                          | Purpose                                 |
| ---------------------------------------------------------------- | --------------------------------------- |
| [discord.js](https://discord.js.org/)                            | Core Discord library                    |
| [lavalink-client](https://github.com/Tomato6966/lavalink-client) | Lavalink v4 client for music            |
| [mongoose](https://mongoosejs.com/)                              | MongoDB object modeling                 |
| [axios](https://axios-http.com/)                                 | HTTP requests (weather, GitHub APIs)    |
| [moment](https://momentjs.com/)                                  | Date/time formatting                    |
| [outdent](https://www.npmjs.com/package/outdent)                 | Multi-line string formatting            |
| [dotenv](https://www.npmjs.com/package/dotenv)                   | Loads environment variables from `.env` |


---

## License

This project is licensed under the [MIT License](LICENSE).