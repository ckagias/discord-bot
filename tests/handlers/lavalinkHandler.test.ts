import { EventEmitter } from 'events';

jest.mock('../../utils/musicPersistence', () => ({
    mongoQueueStore: { get: jest.fn(), set: jest.fn(), delete: jest.fn(), stringify: jest.fn(), parse: jest.fn() },
    saveMusicPlayer: jest.fn().mockResolvedValue(undefined),
    deleteMusicPlayer: jest.fn().mockResolvedValue(undefined),
    getMusicPlayer: jest.fn().mockResolvedValue(undefined),
    getSavedSessionId: jest.fn().mockResolvedValue(undefined),
    saveSessionId: jest.fn().mockResolvedValue(undefined),
}));

let capturedOptions: any;
let fakeManager: any;

jest.mock('lavalink-client', () => ({
    LavalinkManager: jest.fn().mockImplementation((options: any) => {
        capturedOptions = options;
        fakeManager = Object.assign(new EventEmitter(), {
            nodeManager: new EventEmitter(),
            createPlayer: jest.fn(),
            utils: { buildTrack: jest.fn() },
        });
        return fakeManager;
    }),
}));

import { mongoQueueStore, getSavedSessionId, saveSessionId, saveMusicPlayer, deleteMusicPlayer, getMusicPlayer } from '../../utils/musicPersistence';

const mockedGetSavedSessionId = getSavedSessionId as jest.Mock;
const mockedSaveSessionId = saveSessionId as jest.Mock;
const mockedSaveMusicPlayer = saveMusicPlayer as jest.Mock;
const mockedDeleteMusicPlayer = deleteMusicPlayer as jest.Mock;
const mockedGetMusicPlayer = getMusicPlayer as jest.Mock;

function makeClient() {
    return { guilds: { cache: new Map() }, channels: { cache: new Map() } } as any;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockedGetSavedSessionId.mockResolvedValue(undefined);
    mockedSaveSessionId.mockResolvedValue(undefined);
    mockedSaveMusicPlayer.mockResolvedValue(undefined);
    mockedDeleteMusicPlayer.mockResolvedValue(undefined);
    mockedGetMusicPlayer.mockResolvedValue(undefined);
});

describe('lavalinkHandler', () => {
    test('passes the mongo queueStore and any saved sessionId into the LavalinkManager config', async () => {
        mockedGetSavedSessionId.mockResolvedValue('saved-session-id');
        const lavalinkHandler = require('../../handlers/lavalinkHandler');

        await lavalinkHandler(makeClient());

        expect(capturedOptions.queueOptions.queueStore).toBe(mongoQueueStore);
        expect(capturedOptions.nodes[0].sessionId).toBe('saved-session-id');
    });

    test('enables resuming and persists the sessionId once the node reports "ready"', async () => {
        const lavalinkHandler = require('../../handlers/lavalinkHandler');
        await lavalinkHandler(makeClient());

        const node = { id: 'main', updateSession: jest.fn().mockResolvedValue(undefined) };
        fakeManager.nodeManager.emit('raw', node, { op: 'ready', sessionId: 'new-session-id', resumed: false });
        await Promise.resolve();

        expect(node.updateSession).toHaveBeenCalledWith(true, expect.any(Number));
        expect(mockedSaveSessionId).toHaveBeenCalledWith('main', 'new-session-id');
    });

    test('ignores non-ready raw payloads', async () => {
        const lavalinkHandler = require('../../handlers/lavalinkHandler');
        await lavalinkHandler(makeClient());

        const node = { id: 'main', updateSession: jest.fn() };
        fakeManager.nodeManager.emit('raw', node, { op: 'playerUpdate' });

        expect(node.updateSession).not.toHaveBeenCalled();
        expect(mockedSaveSessionId).not.toHaveBeenCalled();
    });

    test('recreates a player from saved metadata when the node resumes with a live player', async () => {
        const lavalinkHandler = require('../../handlers/lavalinkHandler');
        const client = makeClient();
        await lavalinkHandler(client);

        mockedGetMusicPlayer.mockResolvedValue({
            guildId: 'g1', voiceChannelId: 'vc1', textChannelId: 'tc1', selfDeaf: true, selfMute: false, requesterId: 'user1',
        });

        const connectMock = jest.fn().mockResolvedValue(undefined);
        const fakePlayer = {
            connect: connectMock,
            filterManager: { data: null },
            queue: { utils: { sync: jest.fn().mockResolvedValue(undefined) }, current: null },
        };
        fakeManager.createPlayer.mockReturnValue(fakePlayer);

        const node = { id: 'main' };
        const lavalinkPlayer = {
            guildId: 'g1', volume: 80, paused: false, filters: {}, track: null,
            state: { connected: true, position: 1000 },
        };

        fakeManager.nodeManager.emit('resumed', node, { resumed: true, sessionId: 's1', op: 'ready' }, [lavalinkPlayer]);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(fakeManager.createPlayer).toHaveBeenCalledWith({
            guildId: 'g1', voiceChannelId: 'vc1', textChannelId: 'tc1', node: 'main',
            volume: 80, selfDeaf: true, selfMute: false,
        });
        expect(connectMock).toHaveBeenCalled();
        expect(fakePlayer.queue.utils.sync).toHaveBeenCalledWith(true, false);
    });

    test('discards saved metadata for a resumed player Lavalink reports as disconnected', async () => {
        const lavalinkHandler = require('../../handlers/lavalinkHandler');
        const client = makeClient();
        await lavalinkHandler(client);

        mockedGetMusicPlayer.mockResolvedValue({ guildId: 'g1', voiceChannelId: 'vc1', textChannelId: 'tc1' });

        const node = { id: 'main' };
        const lavalinkPlayer = { guildId: 'g1', state: { connected: false } };

        fakeManager.nodeManager.emit('resumed', node, { resumed: true, sessionId: 's1', op: 'ready' }, [lavalinkPlayer]);
        await Promise.resolve();
        await Promise.resolve();

        expect(fakeManager.createPlayer).not.toHaveBeenCalled();
        expect(mockedDeleteMusicPlayer).toHaveBeenCalledWith('g1');
    });

    test('persists player metadata on trackStart and removes it on playerDestroy', async () => {
        const lavalinkHandler = require('../../handlers/lavalinkHandler');
        const client = makeClient();
        await lavalinkHandler(client);

        const player = {
            guildId: 'g1', textChannelId: 'tc1', voiceChannelId: 'vc1', node: { id: 'main' },
            options: { selfDeaf: true, selfMute: false },
        };
        const track = { info: { title: 'Song', author: 'Artist' }, requester: { id: 'user1' } };

        fakeManager.emit('trackStart', player, track);
        await Promise.resolve();

        expect(mockedSaveMusicPlayer).toHaveBeenCalledWith('g1', 'main', 'vc1', 'tc1', true, false, 'user1');

        fakeManager.emit('playerDestroy', player);
        await Promise.resolve();

        expect(mockedDeleteMusicPlayer).toHaveBeenCalledWith('g1');
    });
});
