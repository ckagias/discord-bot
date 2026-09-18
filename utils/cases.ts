import { EmbedBuilder, Guild, User } from 'discord.js';
import CaseSchema from '../models/CaseSchema';
import { getLogChannel } from './logger';

// Deleting the highest-numbered case frees its number; on conflict, recompute and retry rather than crash.
const MAX_ATTEMPTS = 5;

interface CreateCaseInput {
    guildId: string;
    type: string;
    userId: string;
    moderatorId: string;
    reason: string;
    duration?: string | null;
}

async function createCase({ guildId, type, userId, moderatorId, reason, duration = null }: CreateCaseInput) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const last = await CaseSchema.findOne({ guildId }).sort({ caseId: -1 });
        const caseId = (last?.caseId ?? 0) + 1;

        try {
            return await CaseSchema.create({ guildId, caseId, type, userId, moderatorId, reason, duration });
        } catch (err: any) {
            if (err.code !== 11000) throw err;
        }
    }

    throw new Error(`Failed to allocate a case number for guild ${guildId} after ${MAX_ATTEMPTS} attempts.`);
}

interface LogModActionInput {
    guild: Guild;
    action: string;
    target: User;
    moderator: User;
    reason: string;
    caseId: number;
    duration?: string | null;
}

// Brings manual mod commands in line with automod/antiraid logging via getLogChannel.
async function logModAction({ guild, action, target, moderator, reason, caseId, duration }: LogModActionInput): Promise<void> {
    const logChannel = await getLogChannel(guild, 'moderation').catch(() => null);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL({ size: 64 }) })
        .addFields(
            { name: 'User',      value: `${target} (\`${target.id}\`)`, inline: true },
            { name: 'Moderator', value: `${moderator}`,                  inline: true },
            { name: 'Action',    value: action,                          inline: true },
            { name: 'Reason',    value: reason,                          inline: false },
        )
        .setFooter({ text: `Case #${caseId}` })
        .setTimestamp();

    if (duration) {
        embed.addFields({ name: 'Duration', value: duration, inline: true });
    }

    await (logChannel as any).send({ embeds: [embed] }).catch(() => {});
}

export { createCase, logModAction };
