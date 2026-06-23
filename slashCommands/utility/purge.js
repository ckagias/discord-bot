const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Deletes a specific number of messages.')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    permissions: PermissionFlagsBits.ManageMessages,

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');

        try {
            // bulkDelete's second arg filters out messages older than 14 days (Discord's limit)
            const deletedMessages = await interaction.channel.bulkDelete(amount, true);
            await interaction.reply({ content: `Successfully deleted **${deletedMessages.size}** messages!` });
        } catch (error) {
            console.error('[purge] Error:', error);
            await interaction.reply({ content: 'I cannot delete messages that are older than 14 days or I lack permissions.' });
        }
    }
};