const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a member by assigning the mute role.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    permissions: PermissionFlagsBits.ModerateMembers,

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        if (!target) {
            return interaction.editReply({ content: 'That user is not in this server.' });
        }

        if (interaction.member.roles.highest.position <= target.roles.highest.position) {
            return interaction.editReply({ content: 'You cannot mute someone with an equal or higher role.' });
        }

        const guildData = await getGuildConfig(interaction.guild.id);

        if (!guildData?.muteRoleId) {
            return interaction.editReply({ content: 'No mute role set. Use `/setmuterole` first.' });
        }

        const muteRole = interaction.guild.roles.cache.get(guildData.muteRoleId);

        if (!muteRole) {
            return interaction.editReply({ content: 'The configured mute role no longer exists. Use `/setmuterole` to set a new one.' });
        }

        if (target.roles.cache.has(muteRole.id)) {
            return interaction.editReply({ content: 'That user is already muted.' });
        }

        const textChannels = interaction.guild.channels.cache.filter(c => c.isTextBased());
        const voiceChannels = interaction.guild.channels.cache.filter(c => c.isVoiceBased());

        await Promise.allSettled([
            ...textChannels.map(c => c.permissionOverwrites.edit(muteRole, {
                SendMessages: false,
                SendMessagesInThreads: false,
                AddReactions: false,
            })),
            ...voiceChannels.map(c => c.permissionOverwrites.edit(muteRole, {
                Speak: false,
                Connect: false,
            })),
        ]);

        await target.roles.add(muteRole, reason);
        return interaction.editReply({ content: `Muted **${target.user.tag}** for \`${reason}\`` });
    },
};