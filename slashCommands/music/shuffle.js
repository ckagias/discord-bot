const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const log = require('../../utils/log');
const logger = log.scope('shuffle');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffle the upcoming tracks in the queue.'),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player || !player.queue.current) {
            return interaction.reply({ content: 'Nothing is playing right now.', flags: MessageFlags.Ephemeral });
        }

        if (player.queue.tracks.length < 2) {
            return interaction.reply({ content: 'Not enough tracks in the queue to shuffle.', flags: MessageFlags.Ephemeral });
        }

        try {
            const count = await player.queue.shuffle();

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription(`🔀 Shuffled **${count}** track(s) in the queue.`);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('Lavalink error:', error);
            await interaction.reply({ content: 'Failed to shuffle the queue. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};
