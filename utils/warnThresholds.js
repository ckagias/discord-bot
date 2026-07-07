const { EmbedBuilder } = require('discord.js');
const { getLogChannel } = require('./logger');
const { createCase } = require('./cases');
const { formatDuration } = require('./duration');

// Finds the highest-priority threshold that matches totalWarnings exactly.
// Only fires on the exact count so repeated warnings beyond the last threshold
// don't re-apply the same punishment every time.
function resolveThreshold(thresholds, totalWarnings) {
    return thresholds.find(t => t.count === totalWarnings) ?? null;
}

async function logEscalation(guild, member, action, reason) {
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

    await logChannel.send({ embeds: [embed] }).catch(() => {});
}

// Checks the guild's warn thresholds against totalWarnings and applies the
// matching punishment if one exists. Safe to call from both /warn and automod.
async function checkWarnThresholds(guild, member, totalWarnings, guildData) {
    const thresholds = guildData?.warnThresholds;
    if (!thresholds?.length) return;

    const threshold = resolveThreshold(thresholds, totalWarnings);
    if (!threshold) return;

    const reason = `Automatic escalation: reached ${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`;

    try {
        if (threshold.action === 'timeout') {
            const durationMs = (threshold.duration ?? 300) * 1000;
            if (member?.moderatable) {
                const label = formatDuration(threshold.duration ?? 300);
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
        console.error('[warnThresholds] Failed to apply escalation:', err);
    }
}

module.exports = { checkWarnThresholds };
