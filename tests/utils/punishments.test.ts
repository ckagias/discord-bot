jest.mock('../../models/PunishmentSchema', () => ({
    deleteOne: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockResolvedValue([]),
}));

import { schedulePunishment, liftMute, liftBan } from '../../utils/punishments';
import PunishmentSchema from '../../models/PunishmentSchema';

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

function makeClient() {
    return {
        guilds: { fetch: jest.fn().mockResolvedValue(null) },
    } as any;
}

function makePunishment(overrides: Record<string, unknown> = {}) {
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

describe('liftMute', () => {
    beforeEach(() => jest.clearAllMocks());

    test('deletes the punishment record when the role removal succeeds', async () => {
        const remove = jest.fn().mockResolvedValue(undefined);
        const client = {
            guilds: {
                fetch: jest.fn().mockResolvedValue({
                    members: { fetch: jest.fn().mockResolvedValue({ roles: { remove } }) },
                }),
            },
        } as any;

        await liftMute(client, makePunishment());

        expect(remove).toHaveBeenCalledWith('r1', 'Timed mute expired');
        expect(PunishmentSchema.deleteOne).toHaveBeenCalledWith({ _id: 'p1' });
    });

    test('keeps the punishment record for retry when the role removal fails', async () => {
        const remove = jest.fn().mockRejectedValue(Object.assign(new Error('outage'), { code: 500 }));
        const client = {
            guilds: {
                fetch: jest.fn().mockResolvedValue({
                    members: { fetch: jest.fn().mockResolvedValue({ roles: { remove } }) },
                }),
            },
        } as any;

        await liftMute(client, makePunishment());

        expect(PunishmentSchema.deleteOne).not.toHaveBeenCalled();
    });

    test('deletes the record when the member is already gone (unknown member)', async () => {
        const remove = jest.fn().mockRejectedValue(Object.assign(new Error('unknown member'), { code: 10007 }));
        const client = {
            guilds: {
                fetch: jest.fn().mockResolvedValue({
                    members: { fetch: jest.fn().mockResolvedValue({ roles: { remove } }) },
                }),
            },
        } as any;

        await liftMute(client, makePunishment());

        expect(PunishmentSchema.deleteOne).toHaveBeenCalledWith({ _id: 'p1' });
    });

    test('deletes the record when the guild no longer exists', async () => {
        const client = { guilds: { fetch: jest.fn().mockResolvedValue(null) } } as any;

        await liftMute(client, makePunishment());

        expect(PunishmentSchema.deleteOne).toHaveBeenCalledWith({ _id: 'p1' });
    });
});

describe('liftBan', () => {
    beforeEach(() => jest.clearAllMocks());

    test('deletes the punishment record when the unban succeeds', async () => {
        const unban = jest.fn().mockResolvedValue(undefined);
        const client = { guilds: { fetch: jest.fn().mockResolvedValue({ members: { unban } }) } } as any;

        await liftBan(client, makePunishment({ type: 'ban' }));

        expect(unban).toHaveBeenCalledWith('u1', 'Temp ban expired');
        expect(PunishmentSchema.deleteOne).toHaveBeenCalledWith({ _id: 'p1' });
    });

    test('keeps the punishment record for retry when the unban fails', async () => {
        const unban = jest.fn().mockRejectedValue(Object.assign(new Error('outage'), { code: 500 }));
        const client = { guilds: { fetch: jest.fn().mockResolvedValue({ members: { unban } }) } } as any;

        await liftBan(client, makePunishment({ type: 'ban' }));

        expect(PunishmentSchema.deleteOne).not.toHaveBeenCalled();
    });

    test('deletes the record when the ban is already gone (unknown ban)', async () => {
        const unban = jest.fn().mockRejectedValue(Object.assign(new Error('unknown ban'), { code: 10026 }));
        const client = { guilds: { fetch: jest.fn().mockResolvedValue({ members: { unban } }) } } as any;

        await liftBan(client, makePunishment({ type: 'ban' }));

        expect(PunishmentSchema.deleteOne).toHaveBeenCalledWith({ _id: 'p1' });
    });
});
