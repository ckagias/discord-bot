const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const WarnSchema = require('../../models/WarnSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issue a warning to a member.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return interaction.reply({ content: 'You do not have permission to warn members.', flags: MessageFlags.Ephemeral });

        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        if (!target) {
            return interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });
        }

        if (interaction.member.roles.highest.position <= target.roles.highest.position) {
            return interaction.reply({ content: 'You cannot warn someone with an equal or higher role.', flags: MessageFlags.Ephemeral });
        }

        await WarnSchema.create({
            guildId: interaction.guild.id,
            userId: target.id,
            moderatorId: interaction.user.id,
            reason,
        });

        const totalWarnings = await WarnSchema.countDocuments({ guildId: interaction.guild.id, userId: target.id });

        return interaction.reply({ content: `Warned **${target.user.tag}** (warning #${totalWarnings}) for \`${reason}\`` });
    },
};