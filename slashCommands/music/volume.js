const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set or check the playback volume.')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (1–100)')
                .setMinValue(1)
                .setMaxValue(100)
        ),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Nothing is playing right now.' });
        }

        const level = interaction.options.getInteger('level');

        if (level === null) {
            return interaction.reply({ content: `🔊 Current volume: **${player.volume}%**` });
        }

        try {
            await player.setVolume(level);

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription(`🔊 Volume set to **${level}%**`);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[volume] Lavalink error:', error);
            await interaction.reply({ content: '❌ Failed to set volume. Please try again.' }).catch(() => {});
        }
    },
};