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

describe('runAutoMod spam detection', () => {
    let automod: any;
    let WarnSchema: any;

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        automod = require('../../utils/automod');
        WarnSchema = require('../../models/WarnSchema');
        WarnSchema.create.mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    async function send(count: number, userId = 'u1') {
        const messages = [];
        for (let i = 0; i < count; i++) {
            const message = makeMessage({ userId });
            messages.push(message);
            await automod.runAutoMod(message as any, guildData);
        }
        return messages;
    }

    test('does nothing until the fifth message inside the window', async () => {
        const messages = await send(4);

        expect(WarnSchema.create).not.toHaveBeenCalled();
        expect(messages.every(m => m.delete.mock.calls.length === 0)).toBe(true);
    });

    test('a burst of 20 messages is not punished once per message after the threshold', async () => {
        await send(20);

        // 5 messages trigger a detection and reset the count, so 20 messages are 4 detections, not 16.
        expect(WarnSchema.create).toHaveBeenCalledTimes(4);
    });

    test('the message that triggers the detection is the fifth, and the next one starts a new count', async () => {
        const messages = await send(6);

        expect(WarnSchema.create).toHaveBeenCalledTimes(1);
        expect(messages[4].delete).toHaveBeenCalled();
        expect(messages[5].delete).not.toHaveBeenCalled();
        expect(automod.spamTracker.get('g1:u1')).toHaveLength(1);
    });

    test('counts users separately', async () => {
        await send(3, 'u1');
        await send(3, 'u2');

        expect(WarnSchema.create).not.toHaveBeenCalled();
    });
});
