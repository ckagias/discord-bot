import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
const log = require('../../utils/log');
const logger = log.scope('resume');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused track.'),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: 'Nothing is playing right now.', flags: MessageFlags.Ephemeral });
        }

        if (!player.paused) {
            return interaction.reply({ content: '▶️ The player is not paused.', flags: MessageFlags.Ephemeral });
        }

        try {
            await player.resume();

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription('▶️ Resumed.');

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('Lavalink error:', error);
            await interaction.reply({ content: 'Failed to resume. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};
