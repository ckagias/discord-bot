import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
const log = require('../../utils/log');
const logger = log.scope('slowmode');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set the slowmode delay for the current channel. Use 0 to disable.')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Slowmode delay in seconds (0 to disable, max 21600)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    permissions: PermissionFlagsBits.ManageChannels,

    async execute(interaction: ChatInputCommandInteraction) {
        const seconds = interaction.options.getInteger('seconds');

        try {
            await (interaction.channel as any).setRateLimitPerUser(seconds);

            if (seconds === 0) {
                await interaction.reply('Slowmode has been **disabled** for this channel.');
            } else {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                const parts = [];
                if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
                if (remainingSeconds > 0) parts.push(`${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`);
                await interaction.reply(`Slowmode set to **${parts.join(' ')}** for this channel.`);
            }
        } catch (error) {
            logger.error('Error:', error);
            await interaction.reply({
                content: 'Failed to set slowmode. Make sure I have the **Manage Channels** permission.',
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
