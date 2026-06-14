const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Generate a 7-day invite link for this server.'),

    async execute(interaction) {
        const invite = await interaction.channel.createInvite({
            maxAge: 7 * 24 * 60 * 60,
            maxUses: 0,
            reason: `Requested by ${interaction.user.tag}`,
        });

        const embed = new EmbedBuilder()
            .setTitle(`Invite to ${interaction.guild.name}`)
            .setDescription(`[Click here to join](${invite.url})\n\nOr copy the link below:`)
            .addFields({ name: '🔗 Invite Link', value: `\`\`\`${invite.url}\`\`\`` })
            .addFields({ name: '⏳ Expires', value: '7 days', inline: true }, { name: '🔢 Max Uses', value: 'Unlimited', inline: true })
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setThumbnail(interaction.guild.iconURL())
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
