import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
import type { RepeatMode } from 'lavalink-client' with { 'resolution-mode': 'import' };
const log = require('../../utils/log');
const logger = log.scope('loop');

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

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: 'Nothing is playing right now.', flags: MessageFlags.Ephemeral });
        }

        const mode = interaction.options.getString('mode');

        try {
            await player.setRepeatMode(mode as RepeatMode);

            const labels: Record<string, string> = { off: '➡️ Loop off', track: '🔂 Looping current track', queue: '🔁 Looping queue' };

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription(labels[mode]);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('Lavalink error:', error);
            await interaction.reply({ content: 'Failed to set loop mode. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};
