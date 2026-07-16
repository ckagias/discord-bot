import { PermissionFlagsBits, EmbedBuilder, Message, GuildMember } from 'discord.js';
import WarnSchema from '../models/WarnSchema';
import { getLogChannel } from './logger';
import { checkWarnThresholds } from './warnThresholds';
import { createCase } from './cases';
import { formatDuration } from './duration';
import log = require('./log');
const logger = log.scope('automod');

const EXEMPT_PERMISSIONS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ManageMessages,
];

const INVITE_REGEX = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/\S+/i;

const SPAM_WINDOW_MS = 5_000;
const SPAM_THRESHOLD = 5;

// guildId:userId -> array of message timestamps (ms). In-memory only — resets on restart, which is fine for a flood filter.
const spamTracker = new Map<string, number[]>();

function isExempt(member: GuildMember | null): boolean {
    if (!member) return true;
    return EXEMPT_PERMISSIONS.some(perm => member.permissions.has(perm));
}

function buildWordRegex(word: string): RegExp {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
}

function matchesBannedWord(content: string, wordList: string[]): boolean {
    return wordList.some(word => word && buildWordRegex(word).test(content));
}

function isSpamming(guildId: string, userId: string): boolean {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const timestamps = (spamTracker.get(key) ?? []).filter(t => now - t < SPAM_WINDOW_MS);
    timestamps.push(now);
    spamTracker.set(key, timestamps);
    return timestamps.length >= SPAM_THRESHOLD;
}

function exceedsMentionLimit(message: Message, limit: number): boolean {
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    return mentionCount > limit;
}

function detectFilter(message: Message, guildData: any): string | null {
    if (guildData.automodBannedWords && matchesBannedWord(message.content, guildData.automodBannedWordList ?? [])) {
        return 'banned word';
    }
    if (guildData.automodSpam && isSpamming(message.guild!.id, message.author.id)) {
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

async function applyAction(message: Message, guildData: any, filter: string): Promise<void> {
    const reason = `Auto-moderation: ${filter}`;

    await message.delete().catch(() => {});

    if (guildData.automodAction === 'warn') {
        await WarnSchema.create({
            guildId: message.guild!.id,
            userId: message.author.id,
            moderatorId: message.client.user!.id,
            reason,
        }).catch(err => logger.error('Failed to record warning:', err));

        const totalWarnings = await WarnSchema.countDocuments({
            guildId: message.guild!.id,
            userId: message.author.id,
        }).catch(() => 0);

        await createCase({
            guildId: message.guild!.id,
            type: 'warn',
            userId: message.author.id,
            moderatorId: message.client.user!.id,
            reason,
        }).catch(err => logger.error('Failed to create case:', err));

        await checkWarnThresholds(message.guild!, message.member!, totalWarnings, guildData);

        await message.author.send(
            `You were warned in **${message.guild!.name}** for ${filter}. Your message was removed.`
        ).catch(() => {});
    } else if (guildData.automodAction === 'timeout') {
        const member = message.member;
        if (member?.moderatable) {
            const durationSeconds = guildData.automodTimeoutSeconds ?? 300;
            const durationMs = durationSeconds * 1000;
            const durationLabel = formatDuration(durationMs);

            await member.timeout(durationMs, reason).catch(err => logger.error('Failed to timeout member:', err));

            await createCase({
                guildId: message.guild!.id,
                type: 'timeout',
                userId: message.author.id,
                moderatorId: message.client.user!.id,
                reason,
                duration: durationLabel,
            }).catch(err => logger.error('Failed to create case:', err));

            await message.author.send(
                `You were timed out for **${durationLabel}** in **${message.guild!.name}** for ${filter}. Your message was removed.`
            ).catch(() => {});
        }
    }

    const logChannel = await getLogChannel(message.guild!).catch(() => null);
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
        await (logChannel as any).send({ embeds: [embed] }).catch(() => {});
    }
}

// Returns true if the message was actioned (and therefore deleted) by auto-mod.
async function runAutoMod(message: Message, guildData: any): Promise<boolean> {
    if (!guildData?.automodEnabled) return false;
    if (isExempt(message.member)) return false;

    try {
        const filter = detectFilter(message, guildData);
        if (!filter) return false;
        await applyAction(message, guildData, filter);
        return true;
    } catch (error) {
        logger.error('Failed to process message:', error);
        return false;
    }
}

export { runAutoMod };
