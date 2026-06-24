const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createCase } = require('../../utils/cases');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server.')
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('The ID of the user to unban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the unban')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    permissions: PermissionFlagsBits.BanMembers,

    async execute(interaction) {
        const userId = interaction.options.getString('user_id');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        let ban;
        try {
            ban = await interaction.guild.bans.fetch(userId);
        } catch {
            return interaction.reply({ content: 'That user is not banned.', flags: MessageFlags.Ephemeral });
        }

        const [, modCase] = await Promise.all([
            interaction.guild.members.unban(userId, reason),
            createCase({ guildId: interaction.guild.id, type: 'unban', userId, moderatorId: interaction.user.id, reason }),
        ]);
        return interaction.reply({ content: `Unbanned **${ban.user.tag}** for \`${reason}\` | Case #${modCase.caseId}` });
    },
};