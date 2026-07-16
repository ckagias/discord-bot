import { EmbedBuilder, AuditLogEvent, GuildBan } from 'discord.js';
const { getLogChannel } = require('../utils/logger');

module.exports = {
    name: 'guildBanAdd',
    async execute(ban: GuildBan) {
        const logChannel = await getLogChannel(ban.guild).catch(() => null);
        if (!logChannel) return;

        await new Promise(r => setTimeout(r, 500));

        let moderator = 'Unknown';
        let moderatorId = null;
        let reason = ban.reason || 'No reason provided';

        try {
            const audit = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
            const entry = audit.entries.first();
            if (entry && entry.target?.id === ban.user.id) {
                moderator = entry.executor.username;
                moderatorId = entry.executor.id;
                if (entry.reason) reason = entry.reason;
            }
        } catch {}

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setAuthor({
                name: ban.user.username,
                iconURL: ban.user.displayAvatarURL({ size: 64 }),
            })
            .setDescription(`**${ban.user.username}** was banned from the server`)
            .addFields(
                { name: 'User ID', value: `\`${ban.user.id}\``, inline: true },
                { name: 'Moderator', value: moderatorId ? `**${moderator}**\n\`${moderatorId}\`` : moderator, inline: true },
                { name: 'Reason', value: reason }
            )
            .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};