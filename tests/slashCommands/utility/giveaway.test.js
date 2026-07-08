jest.mock('../../../models/GiveawaySchema', () => ({
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
}));

const GiveawaySchema = require('../../../models/GiveawaySchema');
const giveaway = require('../../../slashCommands/utility/giveaway');

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

function makeInteraction({ sub, prize = 'Nitro', duration = '10m', winners = null, requireRole = null, messageId = 'msg1' } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getString: jest.fn((opt) => (opt === 'prize' ? prize : opt === 'duration' ? duration : messageId)),
            getInteger: jest.fn().mockReturnValue(winners),
            getRole: jest.fn().mockReturnValue(requireRole),
        },
        guild: {
            id: 'g1',
            members: { fetch: jest.fn().mockResolvedValue(new Map()) },
        },
        channel: { id: 'chan1', send: jest.fn().mockResolvedValue({ id: 'msg1' }) },
        user: { id: 'host1' },
        reply: jest.fn().mockResolvedValue({}),
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

function makeClient() {
    return {
        channels: { fetch: jest.fn().mockResolvedValue({ send: jest.fn().mockResolvedValue({}), messages: { fetch: jest.fn().mockResolvedValue({ edit: jest.fn().mockResolvedValue({}) }) } }) },
        guilds: { fetch: jest.fn().mockResolvedValue({ members: { fetch: jest.fn().mockResolvedValue(new Map()) } }) },
    };
}

describe('giveaway command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('start', () => {
        test('rejects an invalid duration', async () => {
            const interaction = makeInteraction({ sub: 'start', duration: 'bogus' });
            const client = makeClient();

            await giveaway.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Invalid duration') })
            );
        });

        test('rejects a duration under 10 seconds', async () => {
            const interaction = makeInteraction({ sub: 'start', duration: '5s' });
            const client = makeClient();

            await giveaway.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('at least 10 seconds') })
            );
        });

        test('posts the giveaway, persists it, and schedules the end', async () => {
            const interaction = makeInteraction({ sub: 'start', duration: '10m', prize: 'Nitro' });
            const client = makeClient();
            GiveawaySchema.create.mockResolvedValue({ _id: 'g1' });
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

            await giveaway.execute(interaction, client);

            expect(interaction.channel.send).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
            );
            expect(GiveawaySchema.create).toHaveBeenCalledWith(
                expect.objectContaining({ prize: 'Nitro', hostId: 'host1' })
            );
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 600000);
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Giveaway started') })
            );
        });
    });

    describe('end', () => {
        test('rejects when no giveaway is found', async () => {
            const interaction = makeInteraction({ sub: 'end' });
            const client = makeClient();
            GiveawaySchema.findOne.mockResolvedValue(null);

            await giveaway.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No active giveaway found') })
            );
        });

        test('rejects when the giveaway already ended', async () => {
            const interaction = makeInteraction({ sub: 'end' });
            const client = makeClient();
            GiveawaySchema.findOne.mockResolvedValue({ ended: true });

            await giveaway.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('already ended') })
            );
        });

        test('ends the giveaway and picks winners', async () => {
            const interaction = makeInteraction({ sub: 'end' });
            const client = makeClient();
            GiveawaySchema.findOne.mockResolvedValue({
                ended: false, entrants: ['a', 'b'], hostId: 'host1', winnerCount: 1,
                save: jest.fn().mockResolvedValue({}), channelId: 'chan1', messageId: 'msg1', prize: 'Nitro', endsAt: new Date(),
                requireRoleId: null,
            });

            await giveaway.execute(interaction, client);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('winner(s) selected') })
            );
        });
    });

    describe('reroll', () => {
        test('rejects when no giveaway is found', async () => {
            const interaction = makeInteraction({ sub: 'reroll' });
            const client = makeClient();
            GiveawaySchema.findOne.mockResolvedValue(null);

            await giveaway.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No giveaway found') })
            );
        });

        test('rejects when the giveaway has not ended yet', async () => {
            const interaction = makeInteraction({ sub: 'reroll' });
            const client = makeClient();
            GiveawaySchema.findOne.mockResolvedValue({ ended: false });

            await giveaway.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('has not ended yet') })
            );
        });

        test('rerolls winners for an ended giveaway', async () => {
            const interaction = makeInteraction({ sub: 'reroll' });
            const client = makeClient();
            GiveawaySchema.findOne.mockResolvedValue({
                ended: true, entrants: ['a', 'b'], hostId: 'host1', winnerCount: 1,
                save: jest.fn().mockResolvedValue({}), channelId: 'chan1', messageId: 'msg1', prize: 'Nitro', endsAt: new Date(),
                requireRoleId: null,
            });

            await giveaway.execute(interaction, client);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Reroll complete.' })
            );
        });
    });

    describe('list', () => {
        test('reports no active giveaways', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            const client = makeClient();
            GiveawaySchema.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

            await giveaway.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No active giveaways') })
            );
        });

        test('lists active giveaways', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            const client = makeClient();
            const sort = jest.fn().mockResolvedValue([{ guildId: 'g1', channelId: 'chan1', messageId: 'msg1', prize: 'Nitro', winnerCount: 1, endsAt: new Date(Date.now() + 60000) }]);
            GiveawaySchema.find.mockReturnValue({ sort });

            await giveaway.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });
});

describe('giveaway.endGiveaway', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('picks winners, excludes the host, and posts results', async () => {
        const client = makeClient();
        const giveawayDoc = {
            entrants: ['host1', 'a', 'b'], hostId: 'host1', winnerCount: 1,
            save: jest.fn().mockResolvedValue({}), channelId: 'chan1', messageId: 'msg1', prize: 'Nitro', endsAt: new Date(),
            requireRoleId: null,
        };

        await giveaway.endGiveaway(client, giveawayDoc);

        expect(giveawayDoc.ended).toBe(true);
        expect(giveawayDoc.winners.length).toBe(1);
        expect(giveawayDoc.winners).not.toContain('host1');
        expect(giveawayDoc.save).toHaveBeenCalled();
    });

    test('announces no valid entrants when the pool is empty after excluding the host', async () => {
        const client = makeClient();
        const giveawayDoc = {
            entrants: ['host1'], hostId: 'host1', winnerCount: 1,
            save: jest.fn().mockResolvedValue({}), channelId: 'chan1', messageId: 'msg1', prize: 'Nitro', endsAt: new Date(),
            requireRoleId: null,
        };

        await giveaway.endGiveaway(client, giveawayDoc);

        expect(giveawayDoc.winners).toEqual([]);
    });

    test('filters entrants by required role when configured', async () => {
        const roleId = 'role1';
        const member = { roles: { cache: { has: jest.fn().mockReturnValue(true) } } };
        const client = {
            channels: { fetch: jest.fn().mockResolvedValue({ send: jest.fn().mockResolvedValue({}), messages: { fetch: jest.fn().mockResolvedValue(null) } }) },
            guilds: { fetch: jest.fn().mockResolvedValue({ members: { fetch: jest.fn().mockResolvedValue(new Map([['a', member]])) } }) },
        };
        const giveawayDoc = {
            entrants: ['a', 'b'], hostId: 'host1', winnerCount: 5,
            save: jest.fn().mockResolvedValue({}), channelId: 'chan1', messageId: 'msg1', prize: 'Nitro', endsAt: new Date(),
            requireRoleId: roleId, guildId: 'g1',
        };

        await giveaway.endGiveaway(client, giveawayDoc);

        expect(giveawayDoc.winners).toEqual(['a']);
    });
});

describe('giveaway.scheduleGiveawayEnd', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('re-arms in MAX_TIMEOUT_MS-sized chunks instead of overflowing setTimeout', () => {
        const client = makeClient();
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        giveaway.scheduleGiveawayEnd(client, { _id: 'g1' }, MAX_TIMEOUT_MS + 5000);

        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), MAX_TIMEOUT_MS);
    });
});
