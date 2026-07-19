import { Message } from 'discord.js';
const LevelSchema = require('../models/LevelSchema');
const AfkSchema = require('../models/AfkSchema');
const TriggerSchema = require('../models/TriggerSchema');
const MessageActivitySchema = require('../models/MessageActivitySchema');
const { runAutoMod } = require('../utils/automod');
const { ensureGuildConfig } = require('../utils/guildConfig');
const { updateBalance } = require('../utils/economy');
const { upsertWithRetry } = require('../utils/upsertRetry');
const log = require('../utils/log');
const logger = log.scope('messageCreate');
const triggerLogger = log.scope('trigger');

const xp_cooldown_ms = 60_000;

module.exports = {
    name: 'messageCreate',

    async execute(message: Message) {
        if (message.author.bot) return;
        if (!message.guild) return;

        const { author, guild, channel } = message;

        const today = new Date().toISOString().slice(0, 10);
        MessageActivitySchema.updateOne(
            { guildId: guild.id, date: today },
            { $inc: { count: 1 } },
            { upsert: true }
        ).catch(error => logger.error('Failed to record message activity:', error));

        let guildData;
        try {
            guildData = await ensureGuildConfig(guild.id);
        } catch (error) {
            logger.error('Failed to load guild settings:', error);
        }

        // Auto-moderation — runs before triggers/leveling so a deleted message doesn't get processed further
        if (guildData?.automodEnabled) {
            const actioned = await runAutoMod(message, guildData);
            if (actioned) return;
        }

        try {
            const triggers = await TriggerSchema.find({ guildId: guild.id }).lean();
            for (const { trigger, response } of triggers) {
                const regex = new RegExp(`(?<![\\p{L}\\p{N}])${trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu');
                if (regex.test(message.content)) {
                    triggerLogger.info(`matched "${trigger}" in message: "${message.content}"`);
                    await message.reply({ content: response, allowedMentions: { repliedUser: false } }).catch(err => triggerLogger.error('reply failed:', err));
                    break;
                }
            }
        } catch (error) {
            logger.error('Trigger check failed:', error);
        }

        try {
            const afkEntry: any = await AfkSchema.findOne({ userId: author.id, guildId: guild.id }).lean();
            if (afkEntry) {
                await AfkSchema.deleteOne({ userId: author.id, guildId: guild.id });
                const awayMs = Date.now() - afkEntry.since.getTime();
                const awayMins = Math.floor(awayMs / 60_000);
                const awayHours = Math.floor(awayMins / 60);
                const timeAway = awayHours > 0
                    ? `${awayHours}h ${awayMins % 60}m`
                    : `${awayMins}m`;
                await message.reply({
                    content: `Welcome back, ${author}! You were AFK for **${timeAway}**.`,
                    allowedMentions: { users: [] },
                }).catch(() => {});
                return;
            }
        } catch (error) {
            logger.error('AFK return check failed:', error);
        }

        if (message.mentions.users.size > 0) {
            const mentionedIds = [...message.mentions.users.keys()]
                .filter(id => id !== message.client.user.id && id !== author.id);

            if (mentionedIds.length > 0) {
                try {
                    const afkEntries: any[] = await AfkSchema.find({ userId: { $in: mentionedIds }, guildId: guild.id }).lean();
                    const afkById = new Map(afkEntries.map(entry => [entry.userId, entry]));

                    for (const [id, mentionedUser] of message.mentions.users) {
                        const mentionedAfk = afkById.get(id);
                        if (!mentionedAfk) continue;
                        const awayMs = Date.now() - mentionedAfk.since.getTime();
                        const awayMins = Math.floor(awayMs / 60_000);
                        const awayHours = Math.floor(awayMins / 60);
                        const timeAway = awayHours > 0
                            ? `${awayHours}h ${awayMins % 60}m`
                            : `${awayMins}m`;
                        await message.reply({
                            content: `**${mentionedUser.tag}** is currently AFK: **${mentionedAfk.reason}** (${timeAway} ago)`,
                            allowedMentions: { users: [] },
                        }).catch(() => {});
                    }
                } catch (error) {
                    logger.error('AFK mention check failed:', error);
                }
            }
        }

        try {
            if (!guildData?.levelingEnabled) return;

            const xpGained = Math.floor(Math.random() * 11) + 15;
            const cooldownCutoff = new Date(Date.now() - xp_cooldown_ms);

            // Atomic XP award — the lastXpAt filter ensures only the first of any concurrent messages wins.
            const userData = await upsertWithRetry(
                LevelSchema,
                {
                    userId: author.id,
                    guildId: guild.id,
                    $or: [{ lastXpAt: { $exists: false } }, { lastXpAt: { $lte: cooldownCutoff } }],
                },
                {
                    $inc: { xp: xpGained },
                    $set: { lastXpAt: new Date() },
                    $setOnInsert: { userId: author.id, guildId: guild.id },
                },
                { returnDocument: 'after' }
            );

            // A non-matching cooldown filter causes upsert to insert a bare doc; detect that via a fresh lastXpAt.
            if (!userData || Date.now() - userData.lastXpAt.getTime() > 1000) return;

            // Passive credit earnings — fires on the same cooldown as XP so it's never spammed.
            const creditsGained = Math.floor(Math.random() * 11) + 5; // 5–15 credits per message
            updateBalance(author.id, guild.id, creditsGained).catch(error => logger.error('Failed to credit passive earnings:', error));

            // Level formula: 100 * (level + 1)^2 XP needed to advance
            const xpNeeded = (level: number) => 100 * Math.pow(level + 1, 2);

            // Loop, not a single if — a big XP grant can cross more than one threshold at once.
            while (true) {
                const needed = xpNeeded(userData.level);
                if (userData.xp < needed) break;

                // Atomic level-up — guards against two concurrent writes both levelling up
                const levelled = await LevelSchema.findOneAndUpdate(
                    { userId: author.id, guildId: guild.id, xp: { $gte: needed }, level: userData.level },
                    { $inc: { xp: -needed, level: 1 } },
                    { returnDocument: 'after' }
                );
                if (!levelled) break;

                userData.level = levelled.level;
                userData.xp = levelled.xp;

                const announceChannel = guildData.levelUpChannelId
                    ? (guild.channels.cache.get(guildData.levelUpChannelId) ?? channel)
                    : channel;
                await (announceChannel as any).send(
                    `🎉 Congratulations ${author}! You leveled up to **Level ${levelled.level}**!`
                ).catch(() => {});

                const roleMapping = guildData.levelRoles?.find(lr => lr.level === levelled.level);
                if (roleMapping) {
                    const role = guild.roles.cache.get(roleMapping.roleId);
                    if (role && message.member && !message.member.roles.cache.has(role.id)) {
                        await message.member.roles.add(role, `Reached level ${levelled.level}`).catch(() => {});
                    }
                }
            }
        } catch (error) {
            logger.error('Leveling error:', error);
        }
    },
};