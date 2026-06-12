const { EmbedBuilder } = require('discord.js');
const { getLogChannel } = require('../utils/logger');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        const logChannel = await getLogChannel(member.guild).catch(() => null);
        if (!logChannel) return;

        const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setAuthor({
                name: member.user.username,
                iconURL: member.user.displayAvatarURL({ size: 64 }),
            })
            .setDescription(`**${member.user.username}** joined the server`)
            .addFields(
                { name: 'User ID', value: `\`${member.user.id}\``, inline: true },
                { name: 'Account Age', value: `${accountAge} day${accountAge !== 1 ? 's' : ''}`, inline: true },
                { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false }
            )
            .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};