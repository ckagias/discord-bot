import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
const log = require('../../utils/log');
const logger = log.scope('skipto');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skipto')
        .setDescription('Skip to a specific position in the queue.')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('Queue position to skip to')
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

        const target = player.queue.tracks[position - 1];

        try {
            await player.skip(position);

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription(`⏭️ Skipped to **${target.info.title}**.`);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('Lavalink error:', error);
            await interaction.reply({ content: 'Failed to skip to that position. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};
