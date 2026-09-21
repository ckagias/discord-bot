jest.mock('../../../models/TicketSchema', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

import TicketSchema from '../../../models/TicketSchema';
import component from '../../../handlers/components/ticketClose';

const mockedTicketSchema = TicketSchema as any;

function makeInteraction() {
    return {
        reply: jest.fn().mockResolvedValue(undefined),
        member: { permissions: { has: jest.fn().mockReturnValue(false) } },
        user: { id: 'user1' },
        channel: { id: 'channel1', delete: jest.fn().mockResolvedValue(undefined) },
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedTicketSchema.findOne.mockResolvedValue({ userId: 'user1', channelId: 'channel1', status: 'open' });
    mockedTicketSchema.findOneAndUpdate.mockResolvedValue({ userId: 'user1', channelId: 'channel1', status: 'closed' });
});

afterEach(() => {
    jest.useRealTimers();
});

describe('ticketClose', () => {
    test('closes the ticket atomically, scoping the update to status: open', async () => {
        const interaction = makeInteraction();

        await component.execute(interaction as any);

        expect(mockedTicketSchema.findOneAndUpdate).toHaveBeenCalledWith(
            { channelId: 'channel1', status: 'open' },
            { status: 'closed' }
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Ticket closed') })
        );
    });

    test('a second concurrent click loses the atomic race and is told the ticket is already closed', async () => {
        const interaction = makeInteraction();

        // Both calls pass the initial findOne check; only the first update wins.
        mockedTicketSchema.findOneAndUpdate
            .mockResolvedValueOnce({ userId: 'user1', channelId: 'channel1', status: 'closed' })
            .mockResolvedValueOnce(null);

        await Promise.all([component.execute(interaction as any), component.execute(interaction as any)]);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Ticket closed') })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'This ticket is already closed.' })
        );
        expect(interaction.reply).toHaveBeenCalledTimes(2);
    });

    test('rejects a close attempt from a non-owner, non-support user without touching the ticket', async () => {
        const interaction = makeInteraction();
        interaction.user.id = 'stranger';

        await component.execute(interaction as any);

        expect(mockedTicketSchema.findOneAndUpdate).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You do not have permission to close this ticket.' })
        );
    });

    test('replies that the ticket is already closed when no open ticket is found', async () => {
        const interaction = makeInteraction();
        mockedTicketSchema.findOne.mockResolvedValue(null);

        await component.execute(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'This ticket is already closed.' })
        );
        expect(mockedTicketSchema.findOneAndUpdate).not.toHaveBeenCalled();
    });
});
