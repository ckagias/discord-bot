jest.mock('../models/PunishmentSchema', () => ({
    deleteOne: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockResolvedValue([]),
}));

const { schedulePunishment } = require('./punishments');

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

function makeClient() {
    return {
        guilds: { fetch: jest.fn().mockResolvedValue(null) },
    };
}

function makePunishment(overrides = {}) {
    return {
        _id: 'p1',
        type: 'mute',
        guildId: 'g1',
        userId: 'u1',
        muteRoleId: 'r1',
        expiresAt: new Date(Date.now() + 1000),
        ...overrides,
    };
}

describe('schedulePunishment', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('schedules a single timer directly when remaining fits under the setTimeout limit', () => {
        const client = makeClient();
        const punishment = makePunishment();
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        schedulePunishment(client, punishment, 5000);

        expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    test('re-arms in MAX_TIMEOUT_MS-sized chunks instead of overflowing setTimeout', () => {
        const client = makeClient();
        const punishment = makePunishment();
        const remaining = MAX_TIMEOUT_MS + 5000;

        schedulePunishment(client, punishment, remaining);

        // First timer must never exceed the 32-bit setTimeout ceiling.
        expect(jest.getTimerCount()).toBe(1);

        jest.advanceTimersByTime(MAX_TIMEOUT_MS);

        // After the first chunk elapses, it should reschedule, not fire the lift yet.
        expect(client.guilds.fetch).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(1);

        jest.advanceTimersByTime(5000);

        expect(client.guilds.fetch).toHaveBeenCalledTimes(1);
    });

    test('fires the lift immediately when remaining is already zero or negative', async () => {
        const client = makeClient();
        const punishment = makePunishment();

        schedulePunishment(client, punishment, -1000);

        jest.advanceTimersByTime(0);
        await Promise.resolve();

        expect(client.guilds.fetch).toHaveBeenCalledTimes(1);
    });

    test('restorePunishments computes remaining from expiresAt by default', () => {
        const client = makeClient();
        const punishment = makePunishment({ expiresAt: new Date(Date.now() + MAX_TIMEOUT_MS + 1000) });
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        schedulePunishment(client, punishment);

        const [, delay] = setTimeoutSpy.mock.calls[0];
        expect(delay).toBeLessThanOrEqual(MAX_TIMEOUT_MS);
    });
});
