# Contributing to Discord Bot

### Help improve an open-source Discord bot built with [discord.js](https://github.com/discordjs/discord.js), Lavalink, and MongoDB

[Getting Started](#getting-started) • [Project Structure](#project-structure) • [Adding a Command](#adding-a-command) • [Adding an Event](#adding-an-event) • [Adding a Component Handler](#adding-a-component-handler) • [Adding a Mongoose Model](#adding-a-mongoose-model) • [Guidelines](#guidelines) • [Submitting a PR](#submitting-a-pr)

---

## Getting Started

1. **Fork and clone the repository**
  ```bash
   git clone https://github.com/ckagias/discord-bot.git
   cd discord-bot
   npm install
  ```
2. **Create a `.env` file** (see [Installation](README.md#installation) in the README for all required keys)
3. **Run the bot locally**
  ```bash
   # Register slash commands with Discord once (or after any command change)
   node src/cmd.js

   # Start the bot
   node src/index.js
  ```
   Or use Docker if you prefer the full stack (bot + MongoDB + Lavalink) locally (see the README).
4. **Create a branch** off `main` for your change:
  ```bash
   git checkout -b feat/my-feature
  ```

---

## Project Structure

```
discord-bot/
├── src/
│   ├── index.js              # Entry point — creates the client and loads handlers
│   └── cmd.js                # Registers slash commands with the Discord API
├── events/                   # One file per Discord event (messageCreate, interactionCreate, …)
├── handlers/
│   ├── slashCommandHandler.js    # Auto-discovers every file in slashCommands/
│   ├── eventHandler.js           # Auto-discovers every file in events/
│   ├── componentHandler.js       # Auto-discovers every file in handlers/components/
│   └── components/               # Button and modal handlers
├── slashCommands/            # Slash commands, organized by category folder
│   ├── fun/
│   ├── info/
│   ├── leveling/
│   ├── minigames/
│   ├── moderation/
│   ├── music/
│   ├── roles/
│   ├── settings/
│   ├── tickets/
│   └── utility/
├── models/                   # Mongoose schemas (one per collection)
├── utils/                    # Shared helpers (automod, embeds, logger, …)
├── data/                     # Static data (fun command response arrays, …)
├── dashboard/                # Optional Next.js web dashboard
└── lavalink/                 # Lavalink server config (used by Docker)
```

---

## Adding a Command

Every command is a single `.js` file dropped into the matching category folder under `slashCommands/`. The handler auto-discovers it so no registration step beyond running `node src/cmd.js` to push the updated command list to Discord.

### Minimal template

```js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('What this command does.'),

    async execute(interaction) {
        await interaction.reply({ content: 'Hello!', flags: MessageFlags.Ephemeral });
    },
};
```

### With a permission gate

Export a `permissions` field set to a `PermissionFlagsBits` value. `interactionCreate.js` checks it automatically before calling `execute()` so you don't need to repeat the check inside the command.

```js
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('An admin-only command.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction) {
        await interaction.reply({ content: 'Done.', flags: MessageFlags.Ephemeral });
    },
};
```

### With subcommands

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('example')
        .setDescription('Example with subcommands.')
        .addSubcommand(sub =>
            sub.setName('foo').setDescription('The foo subcommand.'))
        .addSubcommand(sub =>
            sub.setName('bar').setDescription('The bar subcommand.')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub === 'foo') { /* … */ }
        if (sub === 'bar') { /* … */ }
    },
};
```

### Rules for commands

- `**data` and `execute` are required.** The handler skips files missing either and logs a warning.
- `**permissions` is optional.** Only add it when the command should be restricted — it maps directly to a `PermissionFlagsBits` flag.
- **Always use `MessageFlags.Ephemeral`** for error and confirmation replies that shouldn't stay in chat.
- **Use `interaction.deferReply()` + `interaction.editReply()`** for anything that may take longer than 3 seconds (API calls, database queries).
- **Do not add a new category folder** unless your PR introduces at least 3 related commands that genuinely don't fit an existing category.

---

## Adding an Event

Event files live in `events/`. The handler loads every `.js` file there automatically.

### Template

```js
module.exports = {
    name: 'eventName',  // must match the discord.js event name exactly
    once: false,        // true for one-time events like 'ready'

    async execute(...args) {
        // discord.js passes the event arguments first, then the client as the last arg
        const client = args[args.length - 1];
    },
};
```

For the `ready` event or any event that should only fire once, set `once: true`.

---

## Adding a Component Handler

Button and modal interactions are handled by files in `handlers/components/`. The component handler loads every `.js` file there and routes incoming interactions by `customId`.

### Exact-ID match (single button or modal)

```js
module.exports = {
    type: 'button',       // 'button' or 'modal'
    id: 'my_button_id',   // must match the customId set in the command

    async execute(interaction) {
        await interaction.reply({ content: 'Button clicked!' });
    },
};
```

### Prefix match (dynamic customIds)

Use `prefix` instead of `id` when your customId carries dynamic data (e.g. `confirm_123456` where `123456` is a user ID).

```js
module.exports = {
    type: 'button',
    prefix: 'confirm_',   // matches any customId starting with this string

    async execute(interaction) {
        const userId = interaction.customId.replace('confirm_', '');
        await interaction.reply({ content: `Confirmed for user ${userId}` });
    },
};
```

A file can also export an **array** of handler objects if a single file logically owns multiple related interactions:

```js
module.exports = [
    { type: 'button', id: 'accept', async execute(i) { /* … */ } },
    { type: 'button', id: 'decline', async execute(i) { /* … */ } },
];
```

---

## Adding a Mongoose Model

Models live in `models/`. Use one file per collection. All schema definitions follow the same pattern:

```js
const { model, Schema } = require('mongoose');

const exampleSchema = new Schema({
    guildId: { type: String, required: true },
    userId:  { type: String, required: true },
    value:   { type: String, default: null },
});

// Add compound indexes for any queries that filter on more than one field
exampleSchema.index({ guildId: 1, userId: 1 });

module.exports = model('Example', exampleSchema);
```

**Store Discord snowflakes as `String`, not `Number`.** Snowflakes exceed the JavaScript safe integer limit and will be silently corrupted if stored as numbers.

---

## Guidelines

### General

- Keep each file focused on one thing. A command file handles one command; an event file handles one event.
- Prefer `async/await` over `.then()/.catch()` chains.
- Wrap anything that can fail with a try/catch or `.catch(() => {})`. Never let an uncaught promise rejection crash an interaction.
- Follow the existing code style, no semicolons are not used selectively, indentation is 4 spaces.

### Commits

- Use short, imperative commit messages: `add /weather command`, `fix ticket close permission check`.
- One logical change per commit.

### What not to add

- Commands that duplicate Discord's built-in features without adding clear value.
- Dependencies that aren't genuinely needed. Check if a utility in `utils/` or a native Node/discord.js API already covers your use case.
- Config files or secrets (`.env`, tokens, API keys).

---

## Submitting a PR

1. Make sure `node src/cmd.js` succeeds and all touched commands appear correctly in Discord.
2. Test the happy path **and** at least one error/edge case (missing permissions, invalid input, target not in server).
3. Update the **Commands** table in `README.md` if you added or removed a command.
4. Open a pull request against `main` with a clear title and a short description of what changed and why.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).