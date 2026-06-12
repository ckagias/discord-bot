const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused track.'),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Nothing is playing right now.' });
        }

        if (!player.paused) {
            return interaction.reply({ content: '▶️ The player is not paused.' });
        }

        try {
            await player.resume();

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription('▶️ Resumed.');

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[resume] Lavalink error:', error);
            await interaction.reply({ content: '❌ Failed to resume. Please try again.' }).catch(() => {});
        }
    },
};