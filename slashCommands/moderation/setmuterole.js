const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { updateGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setmuterole')
        .setDescription('Set the role to assign when a member is muted.')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The muted role')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
            return interaction.reply({ content: 'You do not have permission to manage server settings.', flags: MessageFlags.Ephemeral });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const role = interaction.options.getRole('role');

        await updateGuildConfig(interaction.guild.id, { muteRoleId: role.id });

        return interaction.editReply({ content: `Mute role set to ${role}.` });
    },
};