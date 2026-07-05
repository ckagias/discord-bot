const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription("Returns bot's information"),

    async execute(interaction) {
        const client = interaction.client;

        const embed = new EmbedBuilder()
            .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setDescription(`Hi, I'm **${client.user.username}**`)
            .addFields(
                { name: 'Created At', value: `${moment(client.user.createdAt).format('MMMM Do YYYY, h:mm:ss a')} (${moment(client.user.createdAt).fromNow()})`, inline: false },
                { name: '📜 See all commands', value: 'Use `/commands` for the full categorized command list.', inline: false },
                { name: '📊 Bot stats & features', value: 'Use `/botstats` for performance stats and a feature overview.', inline: false },
                { name: '🔗 Invite the bot', value: 'Use `/link` to add the bot to another server.', inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
