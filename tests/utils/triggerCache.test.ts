jest.mock('../../models/TriggerSchema', () => ({ find: jest.fn() }));

let TriggerSchema: any;
let getTriggers: typeof import('../../utils/triggerCache').getTriggers;
let invalidateTriggers: typeof import('../../utils/triggerCache').invalidateTriggers;

// Resets the module registry since the cache Map lives in module-level state.
beforeEach(() => {
    jest.resetModules();
    jest.useRealTimers();
    TriggerSchema = require('../../models/TriggerSchema');
    ({ getTriggers, invalidateTriggers } = require('../../utils/triggerCache'));
    TriggerSchema.find.mockReset();
});

function mockLean(value: any[]) {
    TriggerSchema.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(value) });
}

describe('getTriggers', () => {
    test('fetches from the database on the first call', async () => {
        mockLean([{ trigger: 'hi', response: 'hello' }]);

        const result = await getTriggers('g1');

        expect(TriggerSchema.find).toHaveBeenCalledWith({ guildId: 'g1' });
        expect(result).toEqual([{ trigger: 'hi', response: 'hello' }]);
    });

    test('serves the cached value on a second call without hitting the database again', async () => {
        mockLean([{ trigger: 'hi', response: 'hello' }]);

        await getTriggers('g1');
        await getTriggers('g1');

        expect(TriggerSchema.find).toHaveBeenCalledTimes(1);
    });

    test('re-fetches once the cache entry expires', async () => {
        jest.useFakeTimers();
        mockLean([{ trigger: 'hi', response: 'hello' }]);

        await getTriggers('g1');
        jest.advanceTimersByTime(30_001);
        await getTriggers('g1');

        expect(TriggerSchema.find).toHaveBeenCalledTimes(2);
    });

    test('caches independently per guild', async () => {
        TriggerSchema.find
            .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue([{ trigger: 'a', response: 'a' }]) })
            .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue([{ trigger: 'b', response: 'b' }]) });

        await getTriggers('g1');
        await getTriggers('g2');
        await getTriggers('g1');
        await getTriggers('g2');

        expect(TriggerSchema.find).toHaveBeenCalledTimes(2);
    });
});

describe('invalidateTriggers', () => {
    test('forces the next getTriggers call to hit the database again', async () => {
        mockLean([{ trigger: 'hi', response: 'hello' }]);

        await getTriggers('g1');
        invalidateTriggers('g1');
        await getTriggers('g1');

        expect(TriggerSchema.find).toHaveBeenCalledTimes(2);
    });
});
