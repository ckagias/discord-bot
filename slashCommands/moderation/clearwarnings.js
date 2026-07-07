const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const WarnSchema = require('../../models/WarnSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription('Clear all warnings for a member.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to clear warnings for')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    permissions: PermissionFlagsBits.ModerateMembers,

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('user');
        const result = await WarnSchema.deleteMany({ guildId: interaction.guild.id, userId: target.id });

        if (result.deletedCount === 0) {
            return interaction.editReply({ content: `**${target.tag}** has no warnings to clear.` });
        }

        return interaction.editReply({ content: `Cleared **${result.deletedCount}** warning${result.deletedCount === 1 ? '' : 's'} for **${target.tag}**.` });
    },
};