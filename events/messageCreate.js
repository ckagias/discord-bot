// 'LevelSchema' is the Mongoose model that stores each user's XP and level per server
const LevelSchema = require('../models/LevelSchema');
// 'GuildSchema' is the Mongoose model that stores per-server settings, like whether leveling is enabled
const GuildSchema = require('../models/GuildSchema');
// 'AfkSchema' is the Mongoose model that stores AFK entries for users
const AfkSchema = require('../models/AfkSchema');

const xp_cooldown_ms = 60_000;

// This event fires every time a message is sent in any server the bot is in
module.exports = {
    // The name must match the Discord.js event name exactly so the event handler can register it
    name: 'messageCreate',

    async execute(message) {
        // --- Guard clauses: ignore bots and DMs ---
        // Bots are ignored to prevent infinite loops or XP farming via automated messages
        if (message.author.bot) return;
        // DMs don't have a guild, so leveling doesn't apply there
        if (!message.guild) return;

        // Destructure the properties we'll use most often to keep the code clean
        const { author, guild, channel } = message;

        // --- AFK: Return check ---
        // If the person who sent this message currently has an AFK entry, remove it — they're back
        const afkEntry = await AfkSchema.findOne({ userId: author.id, guildId: guild.id });
        if (afkEntry) {
            await AfkSchema.deleteOne({ userId: author.id, guildId: guild.id });
            // Calculate how long they were away
            const awayMs = Date.now() - afkEntry.since.getTime();
            const awayMins = Math.floor(awayMs / 60_000);
            const awayHours = Math.floor(awayMins / 60);
            const timeAway = awayHours > 0
                ? `${awayHours}h ${awayMins % 60}m`
                : `${awayMins}m`;
            await message.reply({
                content: `👋 Welcome back, ${author}! You were AFK for **${timeAway}**.`,
                allowedMentions: { users: [] }, // Don't actually ping them
            }).catch(() => {});
            // Stop here — don't process leveling or other checks for the return message
            return;
        }

        // --- AFK: Mention check ---
        // If the message mentions any users, check if any of them are currently AFK
        if (message.mentions.users.size > 0) {
            for (const [id, mentionedUser] of message.mentions.users) {
                // Skip if the mentioned user is the bot itself or the message author
                if (id === message.client.user.id || id === author.id) continue;

                // Look up the mentioned user's AFK entry for this server
                const mentionedAfk = await AfkSchema.findOne({ userId: id, guildId: guild.id });
                if (mentionedAfk) {
                    // Calculate how long they've been AFK
                    const awayMs = Date.now() - mentionedAfk.since.getTime();
                    const awayMins = Math.floor(awayMs / 60_000);
                    const awayHours = Math.floor(awayMins / 60);
                    const timeAway = awayHours > 0
                        ? `${awayHours}h ${awayMins % 60}m`
                        : `${awayMins}m`;

                    // Notify the message author that the mentioned user is AFK
                    await message.reply({
                        content: `🌙 **${mentionedUser.tag}** is currently AFK: **${mentionedAfk.reason}** (${timeAway} ago)`,
                        allowedMentions: { users: [] }, // Don't ping anyone
                    }).catch(() => {});
                }
            }
        }

        // findOneAndUpdate with upsert:true creates the document if it doesn't exist yet,
        // saving us a separate "create on first use" step.
        const guildData = await GuildSchema.findOneAndUpdate(
            { guildId: guild.id },
            { $setOnInsert: { guildId: guild.id } },
            { upsert: true, new: true }
        );

        if (!guildData?.levelingEnabled) return;

        // --- 2. Fetch user data (or create on first message) ---
        let userData = await LevelSchema.findOneAndUpdate(
            { userId: author.id, guildId: guild.id },
            { $setOnInsert: { userId: author.id, guildId: guild.id } },
            { upsert: true, returnDocument: true }
        );

        // --- Cooldown check (persistent — survives restarts) ---
        const now = Date.now();
        if (userData.lastXpAt && now - userData.lastXpAt.getTime() < xp_cooldown_ms) return;

        // --- Award random XP (15–25) ---
        const xpGained = Math.floor(Math.random() * 11) + 15;

        // Add the XP they just earned to their running total
        userData.xp += xpGained;

        // --- 4. Level-up check ---
        // Formula: a user needs 100 * (currentLevel + 1)^2 XP to reach the next level.
        // Level 0 → 1 requires 100 XP, Level 1 → 2 requires 400 XP, etc.
        // This makes higher levels progressively harder to reach.
        const xpNeeded = 100 * Math.pow(userData.level + 1, 2);

        // Check if the user has accumulated enough XP to level up
        if (userData.xp >= xpNeeded) {
            // Subtract the threshold instead of resetting to 0 so leftover XP carries forward
            userData.xp -= xpNeeded;
            // Increment their level by 1
            userData.level += 1;

            // Notify the user in the same channel where they leveled up
            await channel.send(
                `🎉 Congratulations ${author}! You leveled up to **Level ${userData.level}**!`
            );
        }

        // --- 5. Save updated data ---
        userData.lastXpAt = new Date();
        await userData.save();
    },
};