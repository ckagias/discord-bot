jest.mock('../../../models/GiveawaySchema', () => ({
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
}));

const GiveawaySchema = require('../../../models/GiveawaySchema');
const giveaway = require('../../../slashCommands/utility/giveaway');

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

function makeGiveawayDoc(overrides: Record<string, unknown> = {}) {
    return {
        _id: 'g1', guildId: 'g1', channelId: 'chan1', messageId: 'msg1', hostId: 'host1',
        prize: 'Nitro', winnerCount: 1, endsAt: new Date(), requireRoleId: null,
        ended: false, entrants: ['a', 'b'], winners: [],
        ...overrides,
    };
}

function makeInteraction({ sub, prize = 'Nitro', duration = '10m', winners = null, requireRole = null, messageId = 'msg1' }: { sub: string; prize?: string; duration?: string; winners?: number | null; requireRole?: any; messageId?: string }) {
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
            GiveawaySchema.findOne.mockResolvedValue(makeGiveawayDoc());
            GiveawaySchema.findOneAndUpdate.mockResolvedValue(makeGiveawayDoc({ ended: true }));

            await giveaway.execute(interaction, client);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('winner(s) selected') })
            );
        });

        test('says so when another caller ended the giveaway first', async () => {
            const interaction = makeInteraction({ sub: 'end' });
            const client = makeClient();
            GiveawaySchema.findOne.mockResolvedValue(makeGiveawayDoc());
            GiveawaySchema.findOneAndUpdate.mockResolvedValue(null);

            await giveaway.execute(interaction, client);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'That giveaway has already ended.' })
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
        GiveawaySchema.findOneAndUpdate.mockResolvedValue(makeGiveawayDoc({ entrants: ['host1', 'a', 'b'], ended: true }));

        const result = await giveaway.endGiveaway(client, makeGiveawayDoc());

        expect(result).toBe(true);
        const { $set } = GiveawaySchema.updateOne.mock.calls[0][1];
        expect($set.winners.length).toBe(1);
        expect($set.winners).not.toContain('host1');
    });

    test('claims the giveaway only if it has not ended yet', async () => {
        const client = makeClient();
        GiveawaySchema.findOneAndUpdate.mockResolvedValue(makeGiveawayDoc({ ended: true }));

        await giveaway.endGiveaway(client, makeGiveawayDoc());

        expect(GiveawaySchema.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'g1', ended: false },
            { $set: { ended: true } },
            { returnDocument: 'after' }
        );
    });

    test('picks winners from the stored entrants, not the stale in-memory document', async () => {
        const client = makeClient();
        // Created when the giveaway started, before anyone entered.
        const staleDoc = makeGiveawayDoc({ entrants: [] });
        GiveawaySchema.findOneAndUpdate.mockResolvedValue(makeGiveawayDoc({ entrants: ['a'], ended: true }));

        await giveaway.endGiveaway(client, staleDoc);

        expect(GiveawaySchema.updateOne).toHaveBeenCalledWith({ _id: 'g1' }, { $set: { winners: ['a'] } });
        const channel = await client.channels.fetch.mock.results[0].value;
        expect(channel.send).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Congratulations <@a>') })
        );
    });

    test('does nothing when the giveaway was already ended', async () => {
        const client = makeClient();
        GiveawaySchema.findOneAndUpdate.mockResolvedValue(null);

        const result = await giveaway.endGiveaway(client, makeGiveawayDoc());

        expect(result).toBe(false);
        expect(GiveawaySchema.updateOne).not.toHaveBeenCalled();
        expect(client.channels.fetch).not.toHaveBeenCalled();
    });

    test('announces no valid entrants when the pool is empty after excluding the host', async () => {
        const client = makeClient();
        GiveawaySchema.findOneAndUpdate.mockResolvedValue(makeGiveawayDoc({ entrants: ['host1'], ended: true }));

        await giveaway.endGiveaway(client, makeGiveawayDoc());

        expect(GiveawaySchema.updateOne).toHaveBeenCalledWith({ _id: 'g1' }, { $set: { winners: [] } });
    });

    test('filters entrants by required role when configured', async () => {
        const member = { roles: { cache: { has: jest.fn().mockReturnValue(true) } } };
        const client = {
            channels: { fetch: jest.fn().mockResolvedValue({ send: jest.fn().mockResolvedValue({}), messages: { fetch: jest.fn().mockResolvedValue(null) } }) },
            guilds: { fetch: jest.fn().mockResolvedValue({ members: { fetch: jest.fn().mockResolvedValue(new Map([['a', member]])) } }) },
        };
        GiveawaySchema.findOneAndUpdate.mockResolvedValue(
            makeGiveawayDoc({ entrants: ['a', 'b'], winnerCount: 5, requireRoleId: 'role1', ended: true })
        );

        await giveaway.endGiveaway(client, makeGiveawayDoc({ requireRoleId: 'role1', winnerCount: 5 }));

        expect(GiveawaySchema.updateOne).toHaveBeenCalledWith({ _id: 'g1' }, { $set: { winners: ['a'] } });
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
