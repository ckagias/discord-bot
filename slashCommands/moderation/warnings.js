const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const WarnSchema = require('../../models/WarnSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('View all warnings for a member.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return interaction.reply({ content: 'You do not have permission to view warnings.', flags: MessageFlags.Ephemeral });

        await interaction.deferReply();

        const target = interaction.options.getUser('user');
        const warnings = await WarnSchema.find({ guildId: interaction.guild.id, userId: target.id }).sort({ createdAt: 1 });

        if (warnings.length === 0) {
            return interaction.editReply({ content: `**${target.tag}** has no warnings.` });
        }

        const embed = new EmbedBuilder()
            .setTitle(`Warnings for ${target.tag}`)
            .setColor(0xFFA500)
            .setDescription(
                warnings.map((w, i) =>
                    `**#${i + 1}** — \`${w.reason}\`\nBy <@${w.moderatorId}> • <t:${Math.floor(w.createdAt / 1000)}:R>`
                ).join('\n\n')
            )
            .setFooter({ text: `${warnings.length} warning${warnings.length === 1 ? '' : 's'} total` });

        return interaction.editReply({ embeds: [embed] });
    },
};