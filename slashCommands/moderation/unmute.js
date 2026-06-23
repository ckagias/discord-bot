const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmute a member by removing the mute role.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to unmute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the unmute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return interaction.reply({ content: 'You do not have permission to unmute members.', flags: MessageFlags.Ephemeral });

        await interaction.deferReply();

        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        if (!target) {
            return interaction.editReply({ content: 'That user is not in this server.' });
        }

        const guildData = await getGuildConfig(interaction.guild.id);

        if (!guildData?.muteRoleId) {
            return interaction.editReply({ content: 'No mute role set. Use `/setmuterole` first.' });
        }

        const muteRole = interaction.guild.roles.cache.get(guildData.muteRoleId);

        if (!muteRole) {
            return interaction.editReply({ content: 'The configured mute role no longer exists. Use `/setmuterole` to set a new one.' });
        }

        if (!target.roles.cache.has(muteRole.id)) {
            return interaction.editReply({ content: 'That user is not muted.' });
        }

        const channels = interaction.guild.channels.cache.filter(c => c.isTextBased() || c.isVoiceBased());

        await Promise.allSettled(
            channels.map(c => c.permissionOverwrites.delete(muteRole))
        );

        await target.roles.remove(muteRole, reason);
        return interaction.editReply({ content: `Unmuted **${target.user.tag}** for \`${reason}\`` });
    },
};