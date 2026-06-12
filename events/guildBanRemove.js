const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getLogChannel } = require('../utils/logger');

module.exports = {
    name: 'guildBanRemove',
    async execute(ban) {
        const logChannel = await getLogChannel(ban.guild).catch(() => null);
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