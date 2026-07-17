import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
const log = require('../../utils/log');
const logger = log.scope('remove');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a track from the queue.')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('Queue position to remove')
                .setMinValue(1)
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player || !player.queue.current) {
            return interaction.reply({ content: 'Nothing is playing right now.', flags: MessageFlags.Ephemeral });
        }

        const position = interaction.options.getInteger('position');

        if (position > player.queue.tracks.length) {
            return interaction.reply({
                content: `Position ${position} doesn't exist. The queue has ${player.queue.tracks.length} track(s).`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const index = position - 1;
        const removed = player.queue.tracks[index];

        try {
            await player.queue.remove(index);

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription(`🗑️ Removed **${removed.info.title}** from the queue.`);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('Lavalink error:', error);
            await interaction.reply({ content: 'Failed to remove that track. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};
