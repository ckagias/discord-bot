import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, GuildMember } from 'discord.js';
const { getGuildConfig } = require('../../utils/guildConfig');
const { createCase } = require('../../utils/cases');

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

    permissions: PermissionFlagsBits.ModerateMembers,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const target = interaction.options.getMember('user') as GuildMember | null;
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

        const [, modCase] = await Promise.all([
            target.roles.remove(muteRole, reason),
            createCase({ guildId: interaction.guild.id, type: 'unmute', userId: target.id, moderatorId: interaction.user.id, reason }),
        ]);
        return interaction.editReply({ content: `Unmuted **${target.user.tag}** for \`${reason}\` | Case #${modCase.caseId}` });
    },
};
