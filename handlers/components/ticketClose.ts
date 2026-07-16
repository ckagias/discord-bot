import { PermissionFlagsBits, MessageFlags, ButtonInteraction } from 'discord.js';
import TicketSchema from '../../models/TicketSchema';
import log from '../../utils/log';
import { ComponentDefinition } from '../../types/discord';
const logger = log.scope('ticket');

const component: ComponentDefinition = {
    type: 'button',
    id: 'ticket_close_btn',

    async execute(interaction: ButtonInteraction) {
        const ticket = await TicketSchema.findOne({ channelId: interaction.channel!.id, status: 'open' });

        if (!ticket)
            return interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral });

        const isSupport = (interaction.member as any).permissions.has(PermissionFlagsBits.ManageChannels);
        const isOwner = ticket.userId === interaction.user.id;

        if (!isSupport && !isOwner)
            return interaction.reply({ content: 'You do not have permission to close this ticket.', flags: MessageFlags.Ephemeral });

        await interaction.reply({ content: `Ticket closed by ${interaction.user}. This channel will be deleted in 5 seconds.` });

        await TicketSchema.findOneAndUpdate({ channelId: interaction.channel!.id }, { status: 'closed' });

        setTimeout(() => {
            (interaction.channel as any).delete().catch((err: unknown) => logger.error('Failed to delete closed ticket channel:', err));
        }, 5000);
    },
};

export = component;
