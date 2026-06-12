const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Set the loop mode.')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Loop mode')
                .setRequired(true)
                .addChoices(
                    { name: 'Off', value: 'off' },
                    { name: 'Track', value: 'track' },
                    { name: 'Queue', value: 'queue' },
                )
        ),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Nothing is playing right now.' });
        }

        const mode = interaction.options.getString('mode');

        try {
            await player.setRepeatMode(mode);

            const labels = { off: '➡️ Loop off', track: '🔂 Looping current track', queue: '🔁 Looping queue' };

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription(labels[mode]);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[loop] Lavalink error:', error);
            await interaction.reply({ content: '❌ Failed to set loop mode. Please try again.' }).catch(() => {});
        }
    },
};