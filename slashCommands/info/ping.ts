import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Returns the bot latency and API ping.'),

    async execute(interaction: ChatInputCommandInteraction) {
        const apiLatency = Math.round(interaction.client.ws.ping);
        const botLatency = Math.round(Date.now() - interaction.createdTimestamp);

        const embed = new EmbedBuilder()
            .setTitle('🏓 | Pong!')
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .addFields(
                { name: 'API Latency', value: `\`${apiLatency} ms\`` },
                { name: 'Bot Latency', value: `\`${botLatency} ms\`` }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
