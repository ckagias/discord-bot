import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
const PollSchema = require('../../models/PollSchema');
const { closePoll } = require('./poll');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pollend')
        .setDescription('End an active poll early.')
        .addStringOption(o =>
            o.setName('message_id')
             .setDescription('The message ID of the poll to end')
             .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const messageId = interaction.options.getString('message_id');
        const poll = await PollSchema.findOne({ messageId, guildId: interaction.guildId, ended: false });

        if (!poll)
            return interaction.reply({ content: 'No active poll found with that message ID.', ephemeral: true });

        const isHost = poll.hostId === interaction.user.id;
        const isAdmin = (interaction.member.permissions as any).has(PermissionFlagsBits.ManageGuild);

        if (!isHost && !isAdmin)
            return interaction.reply({ content: 'Only the poll creator or a server admin can end this poll.', ephemeral: true });

        await interaction.reply({ content: 'Ending the poll...', ephemeral: true });
        await closePoll(interaction.client, poll._id);
    },
};
