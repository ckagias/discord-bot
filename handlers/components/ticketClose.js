const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const TicketSchema = require('../../models/TicketSchema');
const log = require('../../utils/log');
const logger = log.scope('ticket');

module.exports = {
    type: 'button',
    id: 'ticket_close_btn',

    async execute(interaction) {
        const ticket = await TicketSchema.findOne({ channelId: interaction.channel.id, status: 'open' });

        if (!ticket)
            return interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral });

        const isSupport = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
        const isOwner = ticket.userId === interaction.user.id;

        if (!isSupport && !isOwner)
            return interaction.reply({ content: 'You do not have permission to close this ticket.', flags: MessageFlags.Ephemeral });

        await interaction.reply({ content: `Ticket closed by ${interaction.user}. This channel will be deleted in 5 seconds.` });

        await TicketSchema.findOneAndUpdate({ channelId: interaction.channel.id }, { status: 'closed' });

        setTimeout(() => {
            interaction.channel.delete().catch(err => logger.error('Failed to delete closed ticket channel:', err));
        }, 5000);
    },
};
