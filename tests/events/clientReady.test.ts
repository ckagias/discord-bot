jest.mock('../../models/GiveawaySchema', () => ({ find: jest.fn() }));
jest.mock('../../models/GuildSchema', () => ({ find: jest.fn() }));
jest.mock('../../models/PollSchema', () => ({ find: jest.fn() }));
jest.mock('../../models/HeistSchema', () => ({ find: jest.fn(), updateOne: jest.fn() }));
jest.mock('../../models/ReminderSchema', () => ({ find: jest.fn() }));
jest.mock('../../models/TempVCSchema', () => ({ find: jest.fn(), deleteOne: jest.fn() }));
jest.mock('../../slashCommands/utility/giveaway', () => ({
    endGiveaway: jest.fn(),
    scheduleGiveawayEnd: jest.fn(),
}));
jest.mock('../../slashCommands/fun/poll', () => ({ closePoll: jest.fn() }));
jest.mock('../../slashCommands/utility/remind', () => ({
    sendReminder: jest.fn(),
    scheduleReminder: jest.fn(),
}));
jest.mock('../../utils/punishments', () => ({ restorePunishments: jest.fn() }));
jest.mock('../../utils/antiRaid', () => ({ restoreLockdowns: jest.fn() }));
jest.mock('../../utils/economy', () => ({ updateBalance: jest.fn() }));

const GiveawaySchema = require('../../models/GiveawaySchema');
const GuildSchema = require('../../models/GuildSchema');
const PollSchema = require('../../models/PollSchema');
const HeistSchema = require('../../models/HeistSchema');
const ReminderSchema = require('../../models/ReminderSchema');
const TempVCSchema = require('../../models/TempVCSchema');
const { endGiveaway, scheduleGiveawayEnd } = require('../../slashCommands/utility/giveaway');
const { closePoll } = require('../../slashCommands/fun/poll');
const { sendReminder, scheduleReminder } = require('../../slashCommands/utility/remind');
const { restorePunishments } = require('../../utils/punishments');
const { restoreLockdowns } = require('../../utils/antiRaid');
const { updateBalance } = require('../../utils/economy');
const clientReady = require('../../events/clientReady');

function makeClient(overrides = {}) {
    return {
        user: { tag: 'Bot#0001', id: 'bot1', username: 'Bot', setPresence: jest.fn() },
        lavalink: { init: jest.fn().mockResolvedValue({}) },
        guilds: { cache: { get: jest.fn() } },
        ...overrides,
    };
}

describe('clientReady', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        delete process.env.BOT_ACTIVITY_NAME;
        GiveawaySchema.find.mockResolvedValue([]);
        GuildSchema.find.mockResolvedValue([]);
        PollSchema.find.mockResolvedValue([]);
        HeistSchema.find.mockResolvedValue([]);
        ReminderSchema.find.mockResolvedValue([]);
        TempVCSchema.find.mockResolvedValue([]);
        TempVCSchema.deleteOne.mockResolvedValue({});
        restorePunishments.mockResolvedValue({});
        restoreLockdowns.mockResolvedValue({});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('initializes lavalink with the bot user id and username', async () => {
        const client = makeClient();

        await clientReady.execute(client);

        expect(client.lavalink.init).toHaveBeenCalledWith({ id: 'bot1', username: 'Bot' });
    });

    test('sets presence when BOT_ACTIVITY_NAME is configured', async () => {
        process.env.BOT_ACTIVITY_NAME = 'with Discord';
        const client = makeClient();

        await clientReady.execute(client);

        expect(client.user.setPresence).toHaveBeenCalledWith(
            expect.objectContaining({ activities: [expect.objectContaining({ name: 'with Discord' })] })
        );
    });

    test('does not set presence when BOT_ACTIVITY_NAME is not configured', async () => {
        const client = makeClient();

        await clientReady.execute(client);

        expect(client.user.setPresence).not.toHaveBeenCalled();
    });

    describe('giveaway restoration', () => {
        test('ends a giveaway immediately if it already expired while offline', async () => {
            const giveaway = { endsAt: new Date(Date.now() - 1000) };
            GiveawaySchema.find.mockResolvedValue([giveaway]);
            const client = makeClient();

            await clientReady.execute(client);

            expect(endGiveaway).toHaveBeenCalledWith(client, giveaway);
            expect(scheduleGiveawayEnd).not.toHaveBeenCalled();
        });

        test('reschedules a giveaway that has not expired yet', async () => {
            const giveaway = { endsAt: new Date(Date.now() + 60_000) };
            GiveawaySchema.find.mockResolvedValue([giveaway]);
            const client = makeClient();

            await clientReady.execute(client);

            expect(scheduleGiveawayEnd).toHaveBeenCalledWith(client, giveaway, expect.any(Number));
            expect(endGiveaway).not.toHaveBeenCalled();
        });
    });

    describe('poll restoration', () => {
        test('closes an already-expired poll immediately', async () => {
            const poll = { _id: 'p1', endsAt: new Date(Date.now() - 1000) };
            PollSchema.find.mockResolvedValue([poll]);
            const client = makeClient();

            await clientReady.execute(client);

            expect(closePoll).toHaveBeenCalledWith(client, 'p1');
        });

        test('schedules a still-active poll to close later', async () => {
            const poll = { _id: 'p1', endsAt: new Date(Date.now() + 60_000) };
            PollSchema.find.mockResolvedValue([poll]);
            const client = makeClient();
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

            await clientReady.execute(client);

            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
            expect(closePoll).not.toHaveBeenCalled();
        });
    });

    describe('reminder restoration', () => {
        test('sends an already-due reminder immediately', async () => {
            const reminder = { remindAt: new Date(Date.now() - 1000) };
            ReminderSchema.find.mockResolvedValue([reminder]);
            const client = makeClient();

            await clientReady.execute(client);

            expect(sendReminder).toHaveBeenCalledWith(client, reminder);
        });

        test('reschedules a reminder that has not fired yet', async () => {
            const reminder = { remindAt: new Date(Date.now() + 60_000) };
            ReminderSchema.find.mockResolvedValue([reminder]);
            const client = makeClient();

            await clientReady.execute(client);

            expect(scheduleReminder).toHaveBeenCalledWith(client, reminder, expect.any(Number));
        });
    });

    describe('stale heist cleanup', () => {
        test('does nothing when there are no unfinished heists', async () => {
            HeistSchema.find.mockResolvedValue([]);
            const client = makeClient();

            await clientReady.execute(client);

            expect(HeistSchema.updateOne).not.toHaveBeenCalled();
        });

        test('marks unfinished heists as finished and refunds all members', async () => {
            const heist = {
                _id: 'h1', guildId: 'g1', entryFee: 100,
                members: [{ userId: 'u1' }, { userId: 'u2' }],
            };
            HeistSchema.find.mockResolvedValue([heist]);
            const client = makeClient();

            await clientReady.execute(client);

            expect(HeistSchema.updateOne).toHaveBeenCalledWith({ _id: 'h1' }, { $set: { finished: true } });
            expect(updateBalance).toHaveBeenCalledWith('u1', 'g1', 100);
            expect(updateBalance).toHaveBeenCalledWith('u2', 'g1', 100);
        });

        test('continues without throwing if the heist lookup itself fails', async () => {
            HeistSchema.find.mockRejectedValue(new Error('db down'));
            const client = makeClient();

            await expect(clientReady.execute(client)).resolves.not.toThrow();
        });
    });

    test('calls restorePunishments and restoreLockdowns', async () => {
        const client = makeClient();

        await clientReady.execute(client);

        expect(restorePunishments).toHaveBeenCalledWith(client);
        expect(restoreLockdowns).toHaveBeenCalledWith(client);
    });

    describe('autorole restoration', () => {
        test('does nothing when no guild has an autorole configured', async () => {
            GuildSchema.find.mockResolvedValue([]);
            const client = makeClient();

            await expect(clientReady.execute(client)).resolves.not.toThrow();
        });

        test('skips a guild the bot is no longer in', async () => {
            GuildSchema.find.mockResolvedValue([{ guildId: 'gone1', autoroleId: 'role1' }]);
            const client = makeClient();
            client.guilds.cache.get.mockReturnValue(undefined);

            await expect(clientReady.execute(client)).resolves.not.toThrow();
        });

        test('skips if the configured role no longer exists', async () => {
            GuildSchema.find.mockResolvedValue([{ guildId: 'g1', autoroleId: 'gone-role' }]);
            const guild = { roles: { cache: { get: jest.fn().mockReturnValue(undefined) } } };
            const client = makeClient();
            client.guilds.cache.get.mockReturnValue(guild);

            await expect(clientReady.execute(client)).resolves.not.toThrow();
        });

        test('assigns the autorole to members missing it, skipping bots and members who already have it', async () => {
            const role = { id: 'role1' };
            const addRole = jest.fn().mockResolvedValue({});
            const members = new Map([
                ['human-missing', { user: { bot: false }, id: 'human-missing', roles: { cache: { has: () => false }, add: addRole } }],
                ['human-has-it', { user: { bot: false }, id: 'human-has-it', roles: { cache: { has: () => true }, add: addRole } }],
                ['a-bot', { user: { bot: true }, id: 'a-bot', roles: { cache: { has: () => false }, add: addRole } }],
            ]);
            GuildSchema.find.mockResolvedValue([{ guildId: 'g1', autoroleId: 'role1' }]);
            const guild = {
                roles: { cache: { get: jest.fn().mockReturnValue(role) } },
                members: { fetch: jest.fn().mockResolvedValue(members) },
            };
            const client = makeClient();
            client.guilds.cache.get.mockReturnValue(guild);

            await clientReady.execute(client);

            expect(addRole).toHaveBeenCalledTimes(1);
        });
    });

    describe('temp VC restoration', () => {
        test('does nothing when there are no persisted temp VCs', async () => {
            TempVCSchema.find.mockResolvedValue([]);
            const client = makeClient();

            await clientReady.execute(client);

            expect((client as any).tempVCs).toBeUndefined();
        });

        test('restores ownership for a temp VC that still has members', async () => {
            const channel = { members: { size: 1 }, delete: jest.fn() };
            const guild = { channels: { cache: { get: jest.fn().mockReturnValue(channel) } } };
            TempVCSchema.find.mockResolvedValue([{ _id: 'r1', guildId: 'g1', channelId: 'vc1', ownerId: 'user1' }]);
            const client = makeClient();
            client.guilds.cache.get.mockReturnValue(guild);

            await clientReady.execute(client);

            expect((client as any).tempVCs.get('vc1')).toBe('user1');
            expect(TempVCSchema.deleteOne).not.toHaveBeenCalled();
        });

        test('deletes the channel and cleans up the record when the channel is empty', async () => {
            const deleteChannel = jest.fn().mockResolvedValue({});
            const channel = { members: { size: 0 }, delete: deleteChannel };
            const guild = { channels: { cache: { get: jest.fn().mockReturnValue(channel) } } };
            TempVCSchema.find.mockResolvedValue([{ _id: 'r1', guildId: 'g1', channelId: 'vc1', ownerId: 'user1' }]);
            const client = makeClient();
            client.guilds.cache.get.mockReturnValue(guild);

            await clientReady.execute(client);

            expect(deleteChannel).toHaveBeenCalled();
            expect(TempVCSchema.deleteOne).toHaveBeenCalledWith({ _id: 'r1' });
            expect((client as any).tempVCs.has('vc1')).toBe(false);
        });

        test('cleans up the record when the channel no longer exists', async () => {
            const guild = { channels: { cache: { get: jest.fn().mockReturnValue(undefined) } } };
            TempVCSchema.find.mockResolvedValue([{ _id: 'r1', guildId: 'g1', channelId: 'vc1', ownerId: 'user1' }]);
            const client = makeClient();
            client.guilds.cache.get.mockReturnValue(guild);

            await clientReady.execute(client);

            expect(TempVCSchema.deleteOne).toHaveBeenCalledWith({ _id: 'r1' });
            expect((client as any).tempVCs.has('vc1')).toBe(false);
        });

        test('cleans up the record when the bot is no longer in the guild', async () => {
            TempVCSchema.find.mockResolvedValue([{ _id: 'r1', guildId: 'gone1', channelId: 'vc1', ownerId: 'user1' }]);
            const client = makeClient();
            client.guilds.cache.get.mockReturnValue(undefined);

            await clientReady.execute(client);

            expect(TempVCSchema.deleteOne).toHaveBeenCalledWith({ _id: 'r1' });
        });
    });
});
