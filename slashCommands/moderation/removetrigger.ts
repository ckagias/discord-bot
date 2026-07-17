import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
const TriggerSchema = require('../../models/TriggerSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removetrigger')
        .setDescription('Remove a trigger word.')
        .addStringOption(option =>
            option.setName('trigger')
                .setDescription('The trigger word to remove')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    permissions: PermissionFlagsBits.ManageMessages,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const trigger = interaction.options.getString('trigger').toLowerCase();
        const result = await TriggerSchema.deleteOne({ guildId: interaction.guild.id, trigger });

        if (result.deletedCount === 0) {
            return interaction.editReply({ content: `No trigger found for \`${trigger}\`.` });
        }

        return interaction.editReply({ content: `Removed trigger \`${trigger}\`.` });
    },
};
