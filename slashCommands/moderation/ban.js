const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('delete_messages')
                .setDescription('How many days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
            return interaction.reply({ content: 'You do not have permission to ban members.', flags: MessageFlags.Ephemeral });

        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        const deleteDays = interaction.options.getInteger('delete_messages') ?? 0;

        if (!target) {
            return interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });
        }

        if (interaction.member.roles.highest.position <= target.roles.highest.position) {
            return interaction.reply({ content: 'You cannot ban someone with an equal or higher role.', flags: MessageFlags.Ephemeral });
        }

        if (!target.bannable) {
            return interaction.reply({ content: 'I cannot ban that user (check my role position).', flags: MessageFlags.Ephemeral });
        }

        await target.ban({ reason, deleteMessageSeconds: deleteDays * 86400 });
        return interaction.reply({ content: `Banned **${target.user.tag}** for \`${reason}\`` });
    },
};