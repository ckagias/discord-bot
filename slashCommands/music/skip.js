const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current track.'),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player || !player.playing) {
            return interaction.reply({ content: '❌ Nothing is playing right now.' });
        }

        try {
            const skipped = player.queue.current;
            await player.skip();

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription(`⏭️ Skipped **${skipped?.info.title ?? 'current track'}**.`);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[skip] Lavalink error:', error);
            await interaction.reply({ content: '❌ Failed to skip track. Please try again.' }).catch(() => {});
        }
    },
};