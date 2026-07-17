import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
const { dares } = require('../../data/responses');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dare')
        .setDescription('Sends a random dare question'),

    async execute(interaction: ChatInputCommandInteraction) {
        const randomMessage = dares[Math.floor(Math.random() * dares.length)];
        await interaction.reply(`**${randomMessage}**`);
    }
};
