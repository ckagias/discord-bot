import { EmbedBuilder, AuditLogEvent, GuildBan } from 'discord.js';
import { cancelPunishments } from '../utils/punishments';
const { getLogChannel } = require('../utils/logger');

const UNKNOWN_BAN = 10026;

module.exports = {
    name: 'guildBanRemove',
    async execute(ban: GuildBan) {
        // Bans lifted in Discord itself, not through /unban, leave a timed ban's record behind, and its timer would
        // later unban the user from a newer ban. Only cancel it once the user is confirmed not banned: this event
        // also fires for the bot's own unbans and can arrive after the user was banned again.
        const stillBanned = await ban.guild.bans.fetch({ user: ban.user.id, force: true })
            .then(() => true)
            .catch((err: { code?: number }) => err?.code !== UNKNOWN_BAN);
        if (!stillBanned) await cancelPunishments(ban.guild.id, ban.user.id, 'ban');

        const logChannel = await getLogChannel(ban.guild, 'moderation').catch(() => null);
        if (!logChannel) return;

        await new Promise(r => setTimeout(r, 500));

        let moderator = 'Unknown';
        let moderatorId = null;

        try {
            const audit = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 1 });
            const entry = audit.entries.first();
            if (entry && entry.target?.id === ban.user.id) {
                moderator = entry.executor.username;
                moderatorId = entry.executor.id;
            }
        } catch {}

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setAuthor({
                name: ban.user.username,
                iconURL: ban.user.displayAvatarURL({ size: 64 }),
            })
            .setDescription(`**${ban.user.username}** was unbanned from the server`)
            .addFields(
                { name: 'User ID', value: `\`${ban.user.id}\``, inline: true },
                { name: 'Moderator', value: moderatorId ? `**${moderator}**\n\`${moderatorId}\`` : moderator, inline: true }
            )
            .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};