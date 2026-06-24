const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const WarnSchema = require('../models/WarnSchema');
const { getLogChannel } = require('./logger');

const EXEMPT_PERMISSIONS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ManageMessages,
];

const INVITE_REGEX = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/\S+/i;

const SPAM_WINDOW_MS = 5_000;
const SPAM_THRESHOLD = 5;

// guildId:userId -> array of message timestamps (ms). In-memory only — resets on restart, which is fine for a flood filter.
const spamTracker = new Map();

function isExempt(member) {
    if (!member) return true;
    return EXEMPT_PERMISSIONS.some(perm => member.permissions.has(perm));
}

function buildWordRegex(word) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
}

function matchesBannedWord(content, wordList) {
    return wordList.some(word => word && buildWordRegex(word).test(content));
}

function isSpamming(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const timestamps = (spamTracker.get(key) ?? []).filter(t => now - t < SPAM_WINDOW_MS);
    timestamps.push(now);
    spamTracker.set(key, timestamps);
    return timestamps.length >= SPAM_THRESHOLD;
}

function formatTimeoutDuration(seconds) {
    if (seconds >= 604800) return `${Math.round(seconds / 604800)} week(s)`;
    if (seconds >= 86400) return `${Math.round(seconds / 86400)} day(s)`;
    if (seconds >= 3600) return `${Math.round(seconds / 3600)} hour(s)`;
    if (seconds >= 60) return `${Math.round(seconds / 60)} minute(s)`;
    return `${seconds} second(s)`;
}

function exceedsMentionLimit(message, limit) {
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    return mentionCount > limit;
}

function detectFilter(message, guildData) {
    if (guildData.automodBannedWords && matchesBannedWord(message.content, guildData.automodBannedWordList ?? [])) {
        return 'banned word';
    }
    if (guildData.automodSpam && isSpamming(message.guild.id, message.author.id)) {
        return 'spam';
    }
    if (guildData.automodMentions && exceedsMentionLimit(message, guildData.automodMentionLimit ?? 5)) {
        return 'excessive mentions';
    }
    if (guildData.automodInvites && INVITE_REGEX.test(message.content)) {
        return 'invite link';
    }
    return null;
}

async function applyAction(message, guildData, filter) {
    const reason = `Auto-moderation: ${filter}`;

    await message.delete().catch(() => {});

    if (guildData.automodAction === 'warn') {
        await WarnSchema.create({
            guildId: message.guild.id,
            userId: message.author.id,
            moderatorId: message.client.user.id,
            reason,
        }).catch(err => console.error('[automod] Failed to record warning:', err));

        await message.author.send(
            `You were warned in **${message.guild.name}** for ${filter}. Your message was removed.`
        ).catch(() => {});
    } else if (guildData.automodAction === 'timeout') {
        const member = message.member;
        if (member?.moderatable) {
            const durationMs = (guildData.automodTimeoutSeconds ?? 300) * 1000;
            await member.timeout(durationMs, reason).catch(err => console.error('[automod] Failed to timeout member:', err));

            const durationLabel = formatTimeoutDuration(guildData.automodTimeoutSeconds ?? 300);
            await message.author.send(
                `You were timed out for **${durationLabel}** in **${message.guild.name}** for ${filter}. Your message was removed.`
            ).catch(() => {});
        }
    }

    const logChannel = await getLogChannel(message.guild).catch(() => null);
    if (logChannel) {
        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setAuthor({
                name: message.author.username,
                iconURL: message.author.displayAvatarURL({ size: 64 }),
            })
            .setDescription(`Auto-mod action in ${message.channel}`)
            .addFields(
                { name: 'User', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                { name: 'Filter', value: filter, inline: true },
                { name: 'Action', value: guildData.automodAction, inline: true },
            )
            .setTimestamp();
        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
}

// Returns true if the message was actioned (and therefore deleted) by auto-mod.
async function runAutoMod(message, guildData) {
    if (!guildData?.automodEnabled) return false;
    if (isExempt(message.member)) return false;

    try {
        const filter = detectFilter(message, guildData);
        if (!filter) return false;
        await applyAction(message, guildData, filter);
        return true;
    } catch (error) {
        console.error('[automod] Failed to process message:', error);
        return false;
    }
}

module.exports = { runAutoMod };
