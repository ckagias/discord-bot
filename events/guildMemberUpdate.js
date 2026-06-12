const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getLogChannel } = require('../utils/logger');

module.exports = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember) {
        const logChannel = await getLogChannel(newMember.guild).catch(() => null);
        if (!logChannel) return;

        const embeds = [];

        // Nickname change
        if (oldMember.nickname !== newMember.nickname) {
            await new Promise(r => setTimeout(r, 500));

            let moderator = null;
            let moderatorId = null;

            try {
                const audit = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 });
                const entry = audit.entries.first();
                if (entry && entry.target?.id === newMember.user.id && Date.now() - entry.createdTimestamp < 5000) {
                    // Only show moderator if someone else changed the nickname
                    if (entry.executor.id !== newMember.user.id) {
                        moderator = entry.executor.username;
                        moderatorId = entry.executor.id;
                    }
                }
            } catch {}

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setAuthor({
                    name: newMember.user.username,
                    iconURL: newMember.user.displayAvatarURL({ size: 64 }),
                })
                .setDescription(`**${newMember.user.username}** had their nickname changed`)
                .addFields(
                    { name: 'User ID', value: `\`${newMember.user.id}\``, inline: true },
                    ...(moderatorId ? [{ name: 'Changed By', value: `**${moderator}**\n\`${moderatorId}\``, inline: true }] : []),
                    { name: 'Before', value: oldMember.nickname || '*None*', inline: true },
                    { name: 'After', value: newMember.nickname || '*None*', inline: true }
                )
                .setTimestamp();

            embeds.push(embed);
        }

        // Role changes
        const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
        const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

        if (addedRoles.size > 0 || removedRoles.size > 0) {
            await new Promise(r => setTimeout(r, 500));

            let moderator = null;
            let moderatorId = null;

            try {
                const audit = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 1 });
                const entry = audit.entries.first();
                if (entry && entry.target?.id === newMember.user.id && Date.now() - entry.createdTimestamp < 5000) {
                    moderator = entry.executor.username;
                    moderatorId = entry.executor.id;
                }
            } catch {}

            const fields = [
                { name: 'User ID', value: `\`${newMember.user.id}\``, inline: true },
                ...(moderatorId ? [{ name: 'Changed By', value: `**${moderator}**\n\`${moderatorId}\``, inline: true }] : []),
            ];

            if (addedRoles.size > 0) fields.push({ name: 'Roles Added', value: addedRoles.map(r => `<@&${r.id}>`).join(', '), inline: false });
            if (removedRoles.size > 0) fields.push({ name: 'Roles Removed', value: removedRoles.map(r => `<@&${r.id}>`).join(', '), inline: false });

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setAuthor({
                    name: newMember.user.username,
                    iconURL: newMember.user.displayAvatarURL({ size: 64 }),
                })
                .setDescription(`**${newMember.user.username}** had their roles updated`)
                .addFields(fields)
                .setTimestamp();

            embeds.push(embed);
        }

        for (const embed of embeds) {
            await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    },
};