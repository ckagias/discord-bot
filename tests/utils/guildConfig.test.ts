jest.mock('../../models/GuildSchema', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));

let GuildSchema: any;
let getGuildConfig: typeof import('../../utils/guildConfig').getGuildConfig;
let ensureGuildConfig: typeof import('../../utils/guildConfig').ensureGuildConfig;
let updateGuildConfig: typeof import('../../utils/guildConfig').updateGuildConfig;
let invalidateGuildConfig: typeof import('../../utils/guildConfig').invalidateGuildConfig;
let mockedGuildSchema: any;

// The module keeps its cache Map in module-level state, so reset the module registry
// between tests rather than relying on distinct guildIds to avoid cross-test bleed.
beforeEach(() => {
    jest.resetModules();
    jest.useRealTimers();
    GuildSchema = require('../../models/GuildSchema');
    ({ getGuildConfig, ensureGuildConfig, updateGuildConfig, invalidateGuildConfig } = require('../../utils/guildConfig'));
    mockedGuildSchema = GuildSchema;
    mockedGuildSchema.findOne.mockReset();
    mockedGuildSchema.findOneAndUpdate.mockReset();
});

describe('getGuildConfig', () => {
    test('fetches from the database on the first call', async () => {
        mockedGuildSchema.findOne.mockResolvedValue({ guildId: 'g1', logChannelId: 'c1' });

        const result = await getGuildConfig('g1');

        expect(mockedGuildSchema.findOne).toHaveBeenCalledWith({ guildId: 'g1' });
        expect(result).toEqual({ guildId: 'g1', logChannelId: 'c1' });
    });

    test('serves the cached value on a second call without hitting the database again', async () => {
        mockedGuildSchema.findOne.mockResolvedValue({ guildId: 'g1', logChannelId: 'c1' });

        await getGuildConfig('g1');
        await getGuildConfig('g1');

        expect(mockedGuildSchema.findOne).toHaveBeenCalledTimes(1);
    });

    test('re-fetches once the cache entry expires', async () => {
        jest.useFakeTimers();
        mockedGuildSchema.findOne.mockResolvedValue({ guildId: 'g1', logChannelId: 'c1' });

        await getGuildConfig('g1');
        jest.advanceTimersByTime(30_001);
        await getGuildConfig('g1');

        expect(mockedGuildSchema.findOne).toHaveBeenCalledTimes(2);
    });

    test('caches independently per guild', async () => {
        mockedGuildSchema.findOne
            .mockResolvedValueOnce({ guildId: 'g1' })
            .mockResolvedValueOnce({ guildId: 'g2' });

        await getGuildConfig('g1');
        await getGuildConfig('g2');
        await getGuildConfig('g1');
        await getGuildConfig('g2');

        expect(mockedGuildSchema.findOne).toHaveBeenCalledTimes(2);
    });
});

describe('invalidateGuildConfig', () => {
    test('forces the next getGuildConfig call to hit the database again', async () => {
        mockedGuildSchema.findOne.mockResolvedValue({ guildId: 'g1' });

        await getGuildConfig('g1');
        invalidateGuildConfig('g1');
        await getGuildConfig('g1');

        expect(mockedGuildSchema.findOne).toHaveBeenCalledTimes(2);
    });
});

describe('ensureGuildConfig', () => {
    test('upserts the guild config and invalidates any cached value', async () => {
        mockedGuildSchema.findOne
            .mockResolvedValueOnce({ guildId: 'g1', stale: true })
            .mockResolvedValueOnce({ guildId: 'g1', stale: false });
        mockedGuildSchema.findOneAndUpdate.mockResolvedValue({ guildId: 'g1', stale: false });

        await getGuildConfig('g1');
        const result = await ensureGuildConfig('g1');
        const afterResult = await getGuildConfig('g1');

        expect(mockedGuildSchema.findOneAndUpdate).toHaveBeenCalledWith(
            { guildId: 'g1' },
            { $setOnInsert: { guildId: 'g1' } },
            { upsert: true, returnDocument: 'after' }
        );
        expect(result).toEqual({ guildId: 'g1', stale: false });
        expect(afterResult).toEqual({ guildId: 'g1', stale: false });
        expect(mockedGuildSchema.findOne).toHaveBeenCalledTimes(2);
    });
});

describe('updateGuildConfig', () => {
    test('updates the guild config and invalidates any cached value', async () => {
        mockedGuildSchema.findOne
            .mockResolvedValueOnce({ guildId: 'g1', starboardEnabled: false })
            .mockResolvedValueOnce({ guildId: 'g1', starboardEnabled: true });
        mockedGuildSchema.findOneAndUpdate.mockResolvedValue({ guildId: 'g1', starboardEnabled: true });

        await getGuildConfig('g1');
        await updateGuildConfig('g1', { starboardEnabled: true });
        const afterResult = await getGuildConfig('g1');

        expect(mockedGuildSchema.findOneAndUpdate).toHaveBeenCalledWith(
            { guildId: 'g1' },
            { $set: { starboardEnabled: true }, $setOnInsert: { guildId: 'g1' } },
            { upsert: true }
        );
        expect(afterResult).toEqual({ guildId: 'g1', starboardEnabled: true });
    });
});
