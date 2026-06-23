const { SlashCommandBuilder, EmbedBuilder, OAuth2Scopes, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Generate an invite link for the bot.'),

    async execute(interaction) {
        const link = interaction.client.generateInvite({
            scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
            permissions: [
                PermissionFlagsBits.Administrator,
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('Invite me to your server!')
            .setDescription(`[Click here to invite me](${link})\n\nOr copy the link below:`)
            .addFields({ name: '🔗 Invite Link', value: `\`\`\`${link}\`\`\`` })
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
