const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the current track.'),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player || !player.playing) {
            return interaction.reply({ content: '❌ Nothing is playing right now.' });
        }

        if (player.paused) {
            return interaction.reply({ content: '⏸️ The player is already paused.' });
        }

        try {
            await player.pause();

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription('⏸️ Paused. Use `/resume` to continue.');

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[pause] Lavalink error:', error);
            await interaction.reply({ content: '❌ Failed to pause. Please try again.' }).catch(() => {});
        }
    },
};