import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
const log = require('../../utils/log');
const logger = log.scope('stop');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and clear the queue.'),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: 'Nothing is playing right now.', flags: MessageFlags.Ephemeral });
        }

        try {
            player.setData('manual_stop', true);
            await player.stopPlaying(true, true);
            await player.destroy();

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription('⏹️ Stopped playback and cleared the queue.');

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('Lavalink error:', error);
            await interaction.reply({ content: 'Failed to stop playback. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};
