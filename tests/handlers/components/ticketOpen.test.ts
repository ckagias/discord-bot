jest.mock('../../../utils/guildConfig', () => ({
    getGuildConfig: jest.fn(),
    invalidateGuildConfig: jest.fn(),
}));
jest.mock('../../../models/GuildSchema', () => ({
    findOneAndUpdate: jest.fn(),
}));
jest.mock('../../../models/TicketSchema', () => ({
    findOne: jest.fn(),
    deleteOne: jest.fn(),
    create: jest.fn(),
}));

import { getGuildConfig, invalidateGuildConfig } from '../../../utils/guildConfig';
import GuildSchema from '../../../models/GuildSchema';
import TicketSchema from '../../../models/TicketSchema';
import component from '../../../handlers/components/ticketOpen';

const mockedGetGuildConfig = getGuildConfig as jest.Mock;
const mockedInvalidateGuildConfig = invalidateGuildConfig as jest.Mock;
const mockedGuildSchema = GuildSchema as any;
const mockedTicketSchema = TicketSchema as any;

function makeInteraction() {
    const channel = { id: 'channel1', send: jest.fn().mockResolvedValue(undefined) };
    return {
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        member: { permissions: { has: jest.fn().mockReturnValue(false) } },
        user: { id: 'user1' },
        client: { user: { id: 'bot1' } },
        guild: {
            id: 'g1',
            channels: {
                fetch: jest.fn().mockResolvedValue({ id: 'category1' }),
                create: jest.fn().mockResolvedValue(channel),
            },
        },
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockedGetGuildConfig.mockResolvedValue({ ticketCategoryId: 'category1', ticketSupportRoleId: 'role1' });
    mockedTicketSchema.findOne.mockResolvedValue(null);
    mockedGuildSchema.findOneAndUpdate.mockResolvedValue({ ticketCount: 5 });
});

describe('ticketOpen', () => {
    test('invalidates the cached guild config after incrementing ticketCount', async () => {
        const interaction = makeInteraction();

        await component.execute(interaction as any);

        expect(mockedGuildSchema.findOneAndUpdate).toHaveBeenCalledWith(
            { guildId: 'g1' },
            { $inc: { ticketCount: 1 } },
            { returnDocument: 'after' }
        );
        expect(mockedInvalidateGuildConfig).toHaveBeenCalledWith('g1');
    });

    test('does not touch ticketCount or the cache when the ticket system is not configured', async () => {
        mockedGetGuildConfig.mockResolvedValue({ ticketCategoryId: null, ticketSupportRoleId: null });
        const interaction = makeInteraction();

        await component.execute(interaction as any);

        expect(mockedGuildSchema.findOneAndUpdate).not.toHaveBeenCalled();
        expect(mockedInvalidateGuildConfig).not.toHaveBeenCalled();
    });

    test('a second concurrent click for the same user is rejected instead of creating a duplicate ticket', async () => {
        const interaction = makeInteraction();

        // findOne stays pending so both calls would pass a naive duplicate check.
        let releaseFindOne: () => void;
        mockedTicketSchema.findOne.mockReturnValue(
            new Promise((resolve) => {
                releaseFindOne = () => resolve(null);
            })
        );

        const first = component.execute(interaction as any);
        const second = component.execute(interaction as any);

        // Let both executions block on findOne before releasing it.
        for (let i = 0; i < 10; i++) await Promise.resolve();
        releaseFindOne!();
        await Promise.all([first, second]);

        expect(mockedGuildSchema.findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(interaction.guild.channels.create).toHaveBeenCalledTimes(1);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('already being created') })
        );
    });

    test('the in-flight lock is released after a ticket is created, allowing a later click to proceed normally', async () => {
        const interaction = makeInteraction();

        await component.execute(interaction as any);
        await component.execute(interaction as any);

        expect(mockedGuildSchema.findOneAndUpdate).toHaveBeenCalledTimes(2);
        expect(interaction.guild.channels.create).toHaveBeenCalledTimes(2);
    });

    test('staff bypass the duplicate-ticket check and the in-flight lock entirely', async () => {
        const interaction = makeInteraction();
        interaction.member.permissions.has.mockReturnValue(true);

        await Promise.all([component.execute(interaction as any), component.execute(interaction as any)]);

        expect(mockedTicketSchema.findOne).not.toHaveBeenCalled();
        expect(interaction.guild.channels.create).toHaveBeenCalledTimes(2);
    });
});
