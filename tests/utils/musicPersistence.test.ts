jest.mock('../../models/MusicQueueSchema', () => ({ findOne: jest.fn(), deleteOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../../models/MusicPlayerSchema', () => ({ findOne: jest.fn(), deleteOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../../models/LavalinkSessionSchema', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));

import MusicQueueSchema from '../../models/MusicQueueSchema';
import MusicPlayerSchema from '../../models/MusicPlayerSchema';
import LavalinkSessionSchema from '../../models/LavalinkSessionSchema';
import { mongoQueueStore, saveMusicPlayer, deleteMusicPlayer, getMusicPlayer, getSavedSessionId, saveSessionId } from '../../utils/musicPersistence';

const mockedMusicQueueSchema = MusicQueueSchema as any;
const mockedMusicPlayerSchema = MusicPlayerSchema as any;
const mockedLavalinkSessionSchema = LavalinkSessionSchema as any;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('mongoQueueStore', () => {
    test('get returns the stored data string for the guild', async () => {
        mockedMusicQueueSchema.findOne.mockResolvedValue({ data: '{"current":null}' });

        const result = await mongoQueueStore.get('g1');

        expect(mockedMusicQueueSchema.findOne).toHaveBeenCalledWith({ guildId: 'g1' });
        expect(result).toBe('{"current":null}');
    });

    test('get returns undefined when no queue is stored', async () => {
        mockedMusicQueueSchema.findOne.mockResolvedValue(null);

        const result = await mongoQueueStore.get('g1');

        expect(result).toBeUndefined();
    });

    test('set upserts the stringified queue for the guild', async () => {
        mockedMusicQueueSchema.findOneAndUpdate.mockResolvedValue({});

        await mongoQueueStore.set('g1', '{"current":null}');

        expect(mockedMusicQueueSchema.findOneAndUpdate).toHaveBeenCalledWith(
            { guildId: 'g1' },
            { $set: { data: '{"current":null}' }, $setOnInsert: { guildId: 'g1' } },
            { upsert: true }
        );
    });

    test('delete removes the stored queue for the guild', async () => {
        await mongoQueueStore.delete('g1');

        expect(mockedMusicQueueSchema.deleteOne).toHaveBeenCalledWith({ guildId: 'g1' });
    });

    test('stringify/parse round-trip a StoredQueue through JSON', async () => {
        const value = { current: null, previous: [], tracks: [] };

        const stringified = await mongoQueueStore.stringify(value as any);
        expect(stringified).toBe(JSON.stringify(value));

        const parsed = await mongoQueueStore.parse(stringified as string);
        expect(parsed).toEqual(value);
    });
});

describe('saveMusicPlayer / deleteMusicPlayer / getMusicPlayer', () => {
    test('saveMusicPlayer upserts player metadata for the guild', async () => {
        mockedMusicPlayerSchema.findOneAndUpdate.mockResolvedValue({});

        await saveMusicPlayer('g1', 'main', 'vc1', 'tc1', true, false, 'user1');

        expect(mockedMusicPlayerSchema.findOneAndUpdate).toHaveBeenCalledWith(
            { guildId: 'g1' },
            {
                $set: { nodeId: 'main', voiceChannelId: 'vc1', textChannelId: 'tc1', selfDeaf: true, selfMute: false, requesterId: 'user1' },
                $setOnInsert: { guildId: 'g1' },
            },
            { upsert: true }
        );
    });

    test('deleteMusicPlayer removes the saved player for the guild', async () => {
        await deleteMusicPlayer('g1');

        expect(mockedMusicPlayerSchema.deleteOne).toHaveBeenCalledWith({ guildId: 'g1' });
    });

    test('getMusicPlayer looks up the saved player by guildId', async () => {
        mockedMusicPlayerSchema.findOne.mockResolvedValue({ guildId: 'g1' });

        const result = await getMusicPlayer('g1');

        expect(mockedMusicPlayerSchema.findOne).toHaveBeenCalledWith({ guildId: 'g1' });
        expect(result).toEqual({ guildId: 'g1' });
    });
});

describe('getSavedSessionId / saveSessionId', () => {
    test('getSavedSessionId returns the saved sessionId for the node', async () => {
        mockedLavalinkSessionSchema.findOne.mockResolvedValue({ sessionId: 'abc123' });

        const result = await getSavedSessionId('main');

        expect(mockedLavalinkSessionSchema.findOne).toHaveBeenCalledWith({ nodeId: 'main' });
        expect(result).toBe('abc123');
    });

    test('getSavedSessionId returns undefined when nothing was saved yet', async () => {
        mockedLavalinkSessionSchema.findOne.mockResolvedValue(null);

        const result = await getSavedSessionId('main');

        expect(result).toBeUndefined();
    });

    test('saveSessionId upserts the sessionId for the node', async () => {
        mockedLavalinkSessionSchema.findOneAndUpdate.mockResolvedValue({});

        await saveSessionId('main', 'abc123');

        expect(mockedLavalinkSessionSchema.findOneAndUpdate).toHaveBeenCalledWith(
            { nodeId: 'main' },
            { $set: { sessionId: 'abc123' }, $setOnInsert: { nodeId: 'main' } },
            { upsert: true }
        );
    });
});
