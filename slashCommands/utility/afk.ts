import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import AfkSchema from '../../models/AfkSchema';
const log = require('../../utils/log');
const logger = log.scope('afk');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set your AFK status. The bot will notify people who mention you.')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Why are you going AFK? (optional)')
                .setMaxLength(100)
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const reason = (interaction.options.getString('reason') || 'No reason provided').trim().slice(0, 100);

        try {
            const existing = await AfkSchema.findOne({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
            });

            if (existing) {
                await AfkSchema.deleteOne({ userId: interaction.user.id, guildId: interaction.guild.id });
                return interaction.reply({
                    content: `Welcome back, ${interaction.user}! Your AFK status has been removed.`,
                    allowedMentions: { users: [] },
                });
            }

            await AfkSchema.create({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                reason,
                since: new Date(),
            });

            await interaction.reply({
                content: `You are now AFK: **${reason}**`,
                allowedMentions: { users: [] },
            });
        } catch (error) {
            logger.error('DB error:', error);
            const payload = { content: 'Something went wrong. Please try again.', flags: MessageFlags.Ephemeral };
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply(payload as any).catch(() => {});
            } else {
                await interaction.reply(payload as any).catch(() => {});
            }
        }
    },
};
