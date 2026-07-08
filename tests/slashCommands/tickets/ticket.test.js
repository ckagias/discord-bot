jest.mock('../../../models/TicketSchema', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
}));
jest.mock('../../../utils/guildConfig', () => ({
    getGuildConfig: jest.fn(),
    updateGuildConfig: jest.fn(),
}));

const TicketSchema = require('../../../models/TicketSchema');
const { getGuildConfig, updateGuildConfig } = require('../../../utils/guildConfig');
const ticket = require('../../../slashCommands/tickets/ticket');

function makeInteraction({ sub, hasPermission = true, channelOverrides = {} } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getChannel: jest.fn().mockReturnValue({ id: 'cat1', name: 'Support' }),
            getRole: jest.fn().mockReturnValue({ id: 'role1', toString: () => '@Support' }),
        },
        member: { permissions: { has: jest.fn().mockReturnValue(hasPermission) } },
        guild: { id: 'g1' },
        user: { id: 'user1' },
        channel: {
            id: 'chan1',
            send: jest.fn().mockResolvedValue({}),
            delete: jest.fn().mockResolvedValue({}),
            ...channelOverrides,
        },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('ticket command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('setup', () => {
        test('rejects without Manage Server permission', async () => {
            const interaction = makeInteraction({ sub: 'setup', hasPermission: false });

            await ticket.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Manage Server') })
            );
            expect(updateGuildConfig).not.toHaveBeenCalled();
        });

        test('saves the category and support role when permitted', async () => {
            const interaction = makeInteraction({ sub: 'setup' });

            await ticket.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { ticketCategoryId: 'cat1', ticketSupportRoleId: 'role1' });
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Ticket system configured') })
            );
        });
    });

    describe('panel', () => {
        test('rejects without Manage Server permission', async () => {
            const interaction = makeInteraction({ sub: 'panel', hasPermission: false });

            await ticket.execute(interaction);

            expect(interaction.channel.send).not.toHaveBeenCalled();
        });

        test('rejects when the ticket system has not been configured', async () => {
            const interaction = makeInteraction({ sub: 'panel' });
            getGuildConfig.mockResolvedValue({});

            await ticket.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('not configured') })
            );
            expect(interaction.channel.send).not.toHaveBeenCalled();
        });

        test('posts the ticket panel when configured', async () => {
            const interaction = makeInteraction({ sub: 'panel' });
            getGuildConfig.mockResolvedValue({ ticketCategoryId: 'cat1', ticketSupportRoleId: 'role1' });

            await ticket.execute(interaction);

            expect(interaction.channel.send).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
            );
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Ticket panel posted.' })
            );
        });
    });

    describe('close', () => {
        test('rejects when the channel is not an open ticket', async () => {
            const interaction = makeInteraction({ sub: 'close' });
            TicketSchema.findOne.mockResolvedValue(null);

            await ticket.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('open ticket channel') })
            );
        });

        test('rejects when the closer is neither the ticket owner nor support staff', async () => {
            const interaction = makeInteraction({ sub: 'close', hasPermission: false });
            TicketSchema.findOne.mockResolvedValue({ userId: 'someoneElse', channelId: 'chan1', status: 'open' });

            await ticket.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('do not have permission') })
            );
            expect(TicketSchema.findOneAndUpdate).not.toHaveBeenCalled();
        });

        test('allows the ticket owner to close their own ticket without Manage Channels', async () => {
            jest.useFakeTimers();
            const interaction = makeInteraction({ sub: 'close', hasPermission: false });
            TicketSchema.findOne.mockResolvedValue({ userId: 'user1', channelId: 'chan1', status: 'open' });

            await ticket.execute(interaction);
            jest.advanceTimersByTime(5000);

            expect(TicketSchema.findOneAndUpdate).toHaveBeenCalledWith({ channelId: 'chan1' }, { status: 'closed' });
            expect(interaction.channel.delete).toHaveBeenCalled();
        });

        test('allows support staff to close a ticket that is not theirs', async () => {
            jest.useFakeTimers();
            const interaction = makeInteraction({ sub: 'close', hasPermission: true });
            TicketSchema.findOne.mockResolvedValue({ userId: 'someoneElse', channelId: 'chan1', status: 'open' });

            await ticket.execute(interaction);
            jest.advanceTimersByTime(5000);

            expect(interaction.channel.delete).toHaveBeenCalled();
        });
    });

    describe('stats', () => {
        test('rejects without Manage Server permission', async () => {
            const interaction = makeInteraction({ sub: 'stats', hasPermission: false });

            await ticket.execute(interaction);

            expect(TicketSchema.countDocuments).not.toHaveBeenCalled();
        });

        test('reports ticket counts when permitted', async () => {
            const interaction = makeInteraction({ sub: 'stats' });
            getGuildConfig.mockResolvedValue({ ticketCount: 12 });
            TicketSchema.countDocuments.mockResolvedValueOnce(3).mockResolvedValueOnce(9);

            await ticket.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('reset', () => {
        test('rejects without Administrator permission', async () => {
            const interaction = makeInteraction({ sub: 'reset', hasPermission: false });

            await ticket.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Administrator') })
            );
            expect(TicketSchema.deleteMany).not.toHaveBeenCalled();
        });

        test('resets the counter and deletes ticket records when permitted', async () => {
            const interaction = makeInteraction({ sub: 'reset' });

            await ticket.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { ticketCount: 0 });
            expect(TicketSchema.deleteMany).toHaveBeenCalledWith({ guildId: 'g1' });
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('#0001') })
            );
        });
    });
});
