import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
const log = require('../../utils/log');
const logger = log.scope('pause');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the current track.'),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player || !player.playing) {
            return interaction.reply({ content: 'Nothing is playing right now.', flags: MessageFlags.Ephemeral });
        }

        if (player.paused) {
            return interaction.reply({ content: '⏸️ The player is already paused.', flags: MessageFlags.Ephemeral });
        }

        try {
            await player.pause();

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription('⏸️ Paused. Use `/resume` to continue.');

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('Lavalink error:', error);
            await interaction.reply({ content: 'Failed to pause. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};
