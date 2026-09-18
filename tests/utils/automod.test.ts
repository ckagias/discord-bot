jest.mock('../../models/WarnSchema', () => ({ create: jest.fn().mockResolvedValue(undefined), countDocuments: jest.fn().mockResolvedValue(1) }));
jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn().mockResolvedValue(null) }));
jest.mock('../../utils/warnThresholds', () => ({ checkWarnThresholds: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../utils/cases', () => ({ createCase: jest.fn().mockResolvedValue(undefined) }));

function makeMessage({ guildId = 'g1', userId = 'u1' } = {}) {
    return {
        content: 'hello',
        guild: { id: guildId, name: 'Guild' },
        author: { id: userId, username: `user-${userId}`, bot: false, send: jest.fn().mockResolvedValue(undefined) },
        member: { permissions: { has: () => false } },
        mentions: { users: { size: 0 }, roles: { size: 0 } },
        delete: jest.fn().mockResolvedValue(undefined),
        channel: {},
        client: { user: { id: 'bot1' } },
    };
}

const guildData = { automodEnabled: true, automodSpam: true, automodAction: 'warn' };

describe('runAutoMod spam tracker sweep', () => {
    test('the spam tracker sweep evicts stale user entries instead of leaking them forever', async () => {
        // Fake timers must be active before the module loads its module-level setInterval.
        jest.resetModules();
        jest.useFakeTimers();
        const fresh = require('../../utils/automod');

        await fresh.runAutoMod(makeMessage() as any, guildData);
        expect(fresh.spamTracker.has('g1:u1')).toBe(true);

        jest.advanceTimersByTime(60 * 60 * 1_000);

        expect(fresh.spamTracker.has('g1:u1')).toBe(false);

        jest.useRealTimers();
    });
});
