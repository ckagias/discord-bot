import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription("Returns bot's information"),

    async execute(interaction: ChatInputCommandInteraction) {
        const client = interaction.client;

        const embed = new EmbedBuilder()
            .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL({ dynamic: true } as any) })
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true } as any))
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setDescription(`Hi, I'm **${client.user.username}**`)
            .addFields(
                { name: 'Created At', value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:F> (<t:${Math.floor(client.user.createdTimestamp / 1000)}:R>)`, inline: false },
                { name: '📜 See all commands', value: 'Use `/commands` for the full categorized command list.', inline: false },
                { name: '📊 Bot stats & features', value: 'Use `/botstats` for performance stats and a feature overview.', inline: false },
                { name: '🔗 Invite the bot', value: 'Use `/link` to add the bot to another server.', inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true } as any) })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
