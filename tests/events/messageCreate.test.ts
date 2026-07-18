jest.mock('../../models/LevelSchema', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../../models/AfkSchema', () => ({ findOne: jest.fn(), find: jest.fn(), deleteOne: jest.fn() }));
jest.mock('../../models/TriggerSchema', () => ({ find: jest.fn() }));
jest.mock('../../models/MessageActivitySchema', () => ({ updateOne: jest.fn() }));
jest.mock('../../utils/automod', () => ({ runAutoMod: jest.fn() }));
jest.mock('../../utils/guildConfig', () => ({ ensureGuildConfig: jest.fn() }));
jest.mock('../../utils/economy', () => ({ updateBalance: jest.fn() }));
jest.mock('../../utils/upsertRetry', () => ({ upsertWithRetry: jest.fn() }));

const LevelSchema = require('../../models/LevelSchema');
const AfkSchema = require('../../models/AfkSchema');
const TriggerSchema = require('../../models/TriggerSchema');
const MessageActivitySchema = require('../../models/MessageActivitySchema');
const { runAutoMod } = require('../../utils/automod');
const { ensureGuildConfig } = require('../../utils/guildConfig');
const { updateBalance } = require('../../utils/economy');
const { upsertWithRetry } = require('../../utils/upsertRetry');
const messageCreate = require('../../events/messageCreate');

// Mongoose queries are chainable (e.g. `.find(...).lean()`); mimic that shape for mocked resolved/rejected values.
function leanable(mockFn, value) {
    mockFn.mockReturnValue({ lean: jest.fn().mockResolvedValue(value) });
}
function leanableOnce(mockFn, value) {
    mockFn.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(value) });
}
function leanableRejects(mockFn, error) {
    mockFn.mockReturnValue({ lean: jest.fn().mockRejectedValue(error) });
}
function leanableRejectsOnce(mockFn, error) {
    mockFn.mockReturnValueOnce({ lean: jest.fn().mockRejectedValue(error) });
}

function makeMessage(overrides = {}) {
    return {
        author: { id: 'user1', bot: false },
        guild: {
            id: 'g1',
            channels: { cache: { get: jest.fn() } },
            roles: { cache: { get: jest.fn() } },
        },
        channel: { id: 'chan1', send: jest.fn().mockResolvedValue({}) },
        content: 'hello world',
        mentions: { users: new Map() },
        member: { roles: { cache: { has: jest.fn().mockReturnValue(false) }, add: jest.fn().mockResolvedValue({}) } },
        reply: jest.fn().mockResolvedValue({}),
        client: { user: { id: 'bot1' } },
        ...overrides,
    };
}

describe('messageCreate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        ensureGuildConfig.mockResolvedValue({});
        leanable(TriggerSchema.find, []);
        leanable(AfkSchema.findOne, null);
        leanable(AfkSchema.find, []);
        runAutoMod.mockResolvedValue(false);
        updateBalance.mockResolvedValue({});
        MessageActivitySchema.updateOne.mockResolvedValue({});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('ignores messages from bots', async () => {
        const message = makeMessage({ author: { id: 'bot1', bot: true } });

        await messageCreate.execute(message);

        expect(ensureGuildConfig).not.toHaveBeenCalled();
    });

    test('ignores messages outside a guild (DMs)', async () => {
        const message = makeMessage({ guild: null });

        await messageCreate.execute(message);

        expect(ensureGuildConfig).not.toHaveBeenCalled();
    });

    test('continues processing even if loading guild config fails', async () => {
        ensureGuildConfig.mockRejectedValue(new Error('db down'));
        const message = makeMessage();

        await expect(messageCreate.execute(message)).resolves.not.toThrow();
    });

    describe('automod', () => {
        test('runs automod when enabled and stops further processing if it actioned the message', async () => {
            ensureGuildConfig.mockResolvedValue({ automodEnabled: true });
            runAutoMod.mockResolvedValue(true);
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(runAutoMod).toHaveBeenCalledWith(message, { automodEnabled: true });
            expect(TriggerSchema.find).not.toHaveBeenCalled();
        });

        test('continues to triggers/leveling when automod did not action the message', async () => {
            ensureGuildConfig.mockResolvedValue({ automodEnabled: true });
            runAutoMod.mockResolvedValue(false);
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(TriggerSchema.find).toHaveBeenCalled();
        });

        test('skips automod entirely when disabled', async () => {
            ensureGuildConfig.mockResolvedValue({ automodEnabled: false });
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(runAutoMod).not.toHaveBeenCalled();
        });
    });

    describe('triggers', () => {
        test('replies with the configured response on a trigger match', async () => {
            leanable(TriggerSchema.find, [{ trigger: 'hello', response: 'hi there' }]);
            const message = makeMessage({ content: 'oh hello world' });

            await messageCreate.execute(message);

            expect(message.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'hi there' })
            );
        });

        test('does not match a trigger inside a larger word', async () => {
            leanable(TriggerSchema.find, [{ trigger: 'cat', response: 'meow' }]);
            const message = makeMessage({ content: 'concatenate this' });

            await messageCreate.execute(message);

            expect(message.reply).not.toHaveBeenCalledWith(expect.objectContaining({ content: 'meow' }));
        });

        test('only replies to the first matching trigger, not all matches', async () => {
            leanable(TriggerSchema.find, [
                { trigger: 'hello', response: 'first' },
                { trigger: 'world', response: 'second' },
            ]);
            const message = makeMessage({ content: 'hello world' });

            await messageCreate.execute(message);

            expect(message.reply).toHaveBeenCalledTimes(1);
            expect(message.reply).toHaveBeenCalledWith(expect.objectContaining({ content: 'first' }));
        });

        test('continues processing when the trigger lookup fails', async () => {
            leanableRejects(TriggerSchema.find, new Error('db down'));
            const message = makeMessage();

            await expect(messageCreate.execute(message)).resolves.not.toThrow();
        });
    });

    describe('AFK return', () => {
        test('welcomes the author back and clears their AFK status', async () => {
            leanableOnce(AfkSchema.findOne, { since: new Date(Date.now() - 5 * 60_000) });
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(AfkSchema.deleteOne).toHaveBeenCalledWith({ userId: 'user1', guildId: 'g1' });
            expect(message.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Welcome back') })
            );
        });

        test('stops further processing (leveling) after an AFK return', async () => {
            ensureGuildConfig.mockResolvedValue({ levelingEnabled: true });
            leanableOnce(AfkSchema.findOne, { since: new Date() });
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(upsertWithRetry).not.toHaveBeenCalled();
        });
    });

    describe('AFK mention', () => {
        test('notifies when a mentioned user is AFK', async () => {
            const mentionedUser = { tag: 'Mentioned#0001' };
            const message = makeMessage({ mentions: { users: new Map([['target1', mentionedUser]]) } });
            leanableOnce(AfkSchema.findOne, null); // author not AFK
            leanable(AfkSchema.find, [{ userId: 'target1', reason: 'sleeping', since: new Date(Date.now() - 60_000) }]);

            await messageCreate.execute(message);

            expect(AfkSchema.find).toHaveBeenCalledWith({ userId: { $in: ['target1'] }, guildId: 'g1' });
            expect(message.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('is currently AFK') })
            );
        });

        test('ignores self-mentions and bot mentions when checking AFK', async () => {
            const message = makeMessage({
                mentions: { users: new Map([['user1', { tag: 'Self' }], ['bot1', { tag: 'Bot' }]]) },
            });

            await messageCreate.execute(message);

            expect(AfkSchema.findOne).toHaveBeenCalledTimes(1); // only the author's own AFK check
            expect(AfkSchema.find).not.toHaveBeenCalled(); // no mentions left after filtering self/bot
        });

        test('batches multiple mentions into a single AFK lookup', async () => {
            const message = makeMessage({
                mentions: { users: new Map([['target1', { tag: 'One' }], ['target2', { tag: 'Two' }]]) },
            });
            leanableOnce(AfkSchema.findOne, null);
            leanable(AfkSchema.find, []);

            await messageCreate.execute(message);

            expect(AfkSchema.find).toHaveBeenCalledTimes(1);
            expect(AfkSchema.find).toHaveBeenCalledWith({ userId: { $in: ['target1', 'target2'] }, guildId: 'g1' });
        });

        test('continues when the batched mention AFK lookup fails', async () => {
            const message = makeMessage({ mentions: { users: new Map([['target1', { tag: 'Target' }]]) } });
            leanableOnce(AfkSchema.findOne, null);
            leanableRejectsOnce(AfkSchema.find, new Error('db down'));

            await expect(messageCreate.execute(message)).resolves.not.toThrow();
        });
    });

    describe('leveling', () => {
        test('does nothing when leveling is disabled', async () => {
            ensureGuildConfig.mockResolvedValue({ levelingEnabled: false });
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(upsertWithRetry).not.toHaveBeenCalled();
        });

        test('does nothing when the XP cooldown blocks the write (upsert returns a stale doc)', async () => {
            ensureGuildConfig.mockResolvedValue({ levelingEnabled: true });
            upsertWithRetry.mockResolvedValue({ lastXpAt: new Date(Date.now() - 60_000), level: 0, xp: 0 });
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(updateBalance).not.toHaveBeenCalled();
        });

        test('awards XP and passive credits on a fresh write', async () => {
            ensureGuildConfig.mockResolvedValue({ levelingEnabled: true });
            upsertWithRetry.mockResolvedValue({ lastXpAt: new Date(), level: 0, xp: 10 });
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', expect.any(Number));
        });

        test('levels up and announces when XP crosses the threshold', async () => {
            ensureGuildConfig.mockResolvedValue({ levelingEnabled: true });
            upsertWithRetry.mockResolvedValue({ lastXpAt: new Date(), level: 0, xp: 150 });
            LevelSchema.findOneAndUpdate.mockResolvedValue({ level: 1, xp: 50 });
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(message.channel.send).toHaveBeenCalledWith(expect.stringContaining('leveled up'));
        });

        test('does not announce a level-up if a concurrent write already leveled the user', async () => {
            ensureGuildConfig.mockResolvedValue({ levelingEnabled: true });
            upsertWithRetry.mockResolvedValue({ lastXpAt: new Date(), level: 0, xp: 150 });
            LevelSchema.findOneAndUpdate.mockResolvedValue(null);
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(message.channel.send).not.toHaveBeenCalled();
        });

        test('announces in the configured level-up channel when set', async () => {
            const announceChannel = { send: jest.fn().mockResolvedValue({}) };
            ensureGuildConfig.mockResolvedValue({ levelingEnabled: true, levelUpChannelId: 'announce1' });
            upsertWithRetry.mockResolvedValue({ lastXpAt: new Date(), level: 0, xp: 150 });
            LevelSchema.findOneAndUpdate.mockResolvedValue({ level: 1, xp: 50 });
            const message = makeMessage();
            message.guild.channels.cache.get.mockReturnValue(announceChannel);

            await messageCreate.execute(message);

            expect(announceChannel.send).toHaveBeenCalled();
        });

        test('grants a mapped level role on level-up', async () => {
            const role = { id: 'role1' };
            ensureGuildConfig.mockResolvedValue({ levelingEnabled: true, levelRoles: [{ level: 1, roleId: 'role1' }] });
            upsertWithRetry.mockResolvedValue({ lastXpAt: new Date(), level: 0, xp: 150 });
            LevelSchema.findOneAndUpdate.mockResolvedValue({ level: 1, xp: 50 });
            const message = makeMessage();
            message.guild.roles.cache.get.mockReturnValue(role);

            await messageCreate.execute(message);

            expect(message.member.roles.add).toHaveBeenCalledWith(role, expect.any(String));
        });

        test('continues without throwing when leveling logic errors out', async () => {
            ensureGuildConfig.mockResolvedValue({ levelingEnabled: true });
            upsertWithRetry.mockRejectedValue(new Error('db down'));
            const message = makeMessage();

            await expect(messageCreate.execute(message)).resolves.not.toThrow();
        });

        test('advances more than one level when a single XP grant crosses two thresholds', async () => {
            ensureGuildConfig.mockResolvedValue({ levelingEnabled: true });
            // Level 0 -> 1 needs 100 XP, level 1 -> 2 needs 400 XP; starting at 550 XP crosses both.
            upsertWithRetry.mockResolvedValue({ lastXpAt: new Date(), level: 0, xp: 550 });
            LevelSchema.findOneAndUpdate
                .mockResolvedValueOnce({ level: 1, xp: 450 })
                .mockResolvedValueOnce({ level: 2, xp: 50 });
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(LevelSchema.findOneAndUpdate).toHaveBeenCalledTimes(2);
            expect(message.channel.send).toHaveBeenCalledWith(expect.stringContaining('Level 1'));
            expect(message.channel.send).toHaveBeenCalledWith(expect.stringContaining('Level 2'));
        });

        test('stops advancing once remaining XP is below the next threshold', async () => {
            ensureGuildConfig.mockResolvedValue({ levelingEnabled: true });
            upsertWithRetry.mockResolvedValue({ lastXpAt: new Date(), level: 0, xp: 150 });
            LevelSchema.findOneAndUpdate.mockResolvedValueOnce({ level: 1, xp: 50 });
            const message = makeMessage();

            await messageCreate.execute(message);

            expect(LevelSchema.findOneAndUpdate).toHaveBeenCalledTimes(1);
        });
    });
});
