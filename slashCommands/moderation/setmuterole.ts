import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
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

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const role = interaction.options.getRole('role');

        await updateGuildConfig(interaction.guild.id, { muteRoleId: role.id });

        return interaction.editReply({ content: `Mute role set to ${role}.` });
    },
};
