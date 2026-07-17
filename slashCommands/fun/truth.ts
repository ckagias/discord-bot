import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
const { truths } = require('../../data/responses');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('truth')
        .setDescription('Sends a random truth question'),

    async execute(interaction: ChatInputCommandInteraction) {
        const randomMessage = truths[Math.floor(Math.random() * truths.length)];
        await interaction.reply(`**${randomMessage}**`);
    }
};
