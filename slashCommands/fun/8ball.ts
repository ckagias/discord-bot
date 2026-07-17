import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
const { eightball } = require('../../data/responses');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask a question and let 8ball decide the answer')
        .addStringOption(option =>
            option.setName('question').setDescription('Enter a question').setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        const randomMessage = eightball[Math.floor(Math.random() * eightball.length)];
        const question = interaction.options.getString('question');

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp()
            .setTitle('🎱 ' + question)
            .setDescription(randomMessage);

        await interaction.reply({ embeds: [embed] });
    }
};
