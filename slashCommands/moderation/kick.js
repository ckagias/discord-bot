const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createCase } = require('../../utils/cases');
const log = require('../../utils/log');
const logger = log.scope('kick');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    permissions: PermissionFlagsBits.KickMembers,

    async execute(interaction) {
        try {
            const target = interaction.options.getMember('user');
            const reason = interaction.options.getString('reason') ?? 'No reason provided';

            if (!target) {
                return interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });
            }

            if (interaction.member.roles.highest.position <= target.roles.highest.position) {
                return interaction.reply({ content: 'You cannot kick someone with an equal or higher role.', flags: MessageFlags.Ephemeral });
            }

            if (!target.kickable) {
                return interaction.reply({ content: 'I cannot kick that user (check my role position).', flags: MessageFlags.Ephemeral });
            }

            const [, modCase] = await Promise.all([
                target.kick(reason),
                createCase({ guildId: interaction.guild.id, type: 'kick', userId: target.id, moderatorId: interaction.user.id, reason }),
            ]);
            return interaction.reply({ content: `Kicked **${target.user.tag}** for \`${reason}\` | Case #${modCase.caseId}` });
        } catch (err) {
            logger.error('Error:', err);
            const method = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
            await interaction[method]({ content: 'An error occurred while trying to kick that user.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};