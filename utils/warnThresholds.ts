import { EmbedBuilder, Guild, GuildMember } from 'discord.js';
import { getLogChannel } from './logger';
import { createCase } from './cases';
import { formatDuration } from './duration';
import log = require('./log');
const logger = log.scope('warnThresholds');

interface WarnThreshold {
    count: number;
    action: 'timeout' | 'kick' | 'ban';
    duration?: number | null;
}

// Finds the highest-priority threshold that matches totalWarnings exactly.
// Only fires on the exact count so repeated warnings beyond the last threshold
// don't re-apply the same punishment every time.
function resolveThreshold(thresholds: WarnThreshold[], totalWarnings: number): WarnThreshold | null {
    return thresholds.find(t => t.count === totalWarnings) ?? null;
}

async function logEscalation(guild: Guild, member: GuildMember, action: string, reason: string): Promise<void> {
    const logChannel = await getLogChannel(guild).catch(() => null);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL({ size: 64 }) })
        .setDescription(`Auto-escalation triggered by warning threshold`)
        .addFields(
            { name: 'User',   value: `${member} (\`${member.id}\`)`, inline: true },
            { name: 'Action', value: action,                          inline: true },
            { name: 'Reason', value: reason,                          inline: false },
        )
        .setTimestamp();

    await (logChannel as any).send({ embeds: [embed] }).catch(() => {});
}

// Checks the guild's warn thresholds against totalWarnings and applies the
// matching punishment if one exists. Safe to call from both /warn and automod.
async function checkWarnThresholds(guild: Guild, member: GuildMember, totalWarnings: number, guildData: { warnThresholds?: WarnThreshold[] } | null): Promise<void> {
    const thresholds = guildData?.warnThresholds;
    if (!thresholds?.length) return;

    const threshold = resolveThreshold(thresholds, totalWarnings);
    if (!threshold) return;

    const reason = `Automatic escalation: reached ${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`;

    try {
        if (threshold.action === 'timeout') {
            const durationMs = (threshold.duration ?? 300) * 1000;
            if (member?.moderatable) {
                const label = formatDuration(durationMs);
                await member.timeout(durationMs, reason);
                await createCase({ guildId: guild.id, type: 'timeout', userId: member.id, moderatorId: guild.client.user.id, reason, duration: label }).catch(() => {});
                await member.send(
                    `You have been timed out in **${guild.name}** for **${label}** after reaching ${totalWarnings} warnings.`
                ).catch(() => {});
                await logEscalation(guild, member, `Timeout (${label})`, reason);
            }
        } else if (threshold.action === 'kick') {
            if (member?.kickable) {
                await member.send(
                    `You have been kicked from **${guild.name}** after reaching ${totalWarnings} warnings.`
                ).catch(() => {});
                await member.kick(reason);
                await createCase({ guildId: guild.id, type: 'kick', userId: member.id, moderatorId: guild.client.user.id, reason }).catch(() => {});
                await logEscalation(guild, member, 'Kick', reason);
            }
        } else if (threshold.action === 'ban') {
            if (member?.bannable) {
                await member.send(
                    `You have been banned from **${guild.name}** after reaching ${totalWarnings} warnings.`
                ).catch(() => {});
                await member.ban({ reason });
                await createCase({ guildId: guild.id, type: 'ban', userId: member.id, moderatorId: guild.client.user.id, reason }).catch(() => {});
                await logEscalation(guild, member, 'Ban', reason);
            }
        }
    } catch (err) {
        logger.error('Failed to apply escalation:', err);
    }
}

export { checkWarnThresholds };
