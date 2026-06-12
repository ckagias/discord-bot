const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getLogChannel } = require('../utils/logger');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member) {
        const logChannel = await getLogChannel(member.guild).catch(() => null);
        if (!logChannel) return;

        const roles = member.roles.cache
            .filter(r => r.id !== member.guild.id)
            .map(r => `<@&${r.id}>`)
            .join(', ') || 'None';

        // Check audit log to distinguish kick from voluntary leave
        await new Promise(r => setTimeout(r, 500));

        let kicked = false;
        let moderator = null;
        let moderatorId = null;

        try {
            const audit = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
            const entry = audit.entries.first();
            if (entry && entry.target?.id === member.user.id && Date.now() - entry.createdTimestamp < 5000) {
                kicked = true;
                moderator = entry.executor.username;
                moderatorId = entry.executor.id;
            }
        } catch {}

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setAuthor({
                name: member.user.username,
                iconURL: member.user.displayAvatarURL({ size: 64 }),
            })
            .setDescription(kicked
                ? `**${member.user.username}** was kicked from the server`
                : `**${member.user.username}** left the server`
            )
            .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
            .setTimestamp();

        if (kicked) {
            embed.addFields(
                { name: 'User ID', value: `\`${member.user.id}\``, inline: true },
                { name: 'Moderator', value: `**${moderator}**\n\`${moderatorId}\``, inline: true },
                { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
                { name: 'Roles', value: roles }
            );
        } else {
            embed.addFields(
                { name: 'User ID', value: `\`${member.user.id}\``, inline: true },
                { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
                { name: 'Roles', value: roles }
            );
        }

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};