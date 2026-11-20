import { EventEmitter } from 'events';

jest.mock('../../utils/musicPersistence', () => ({
    mongoQueueStore: { get: jest.fn(), set: jest.fn(), delete: jest.fn(), stringify: jest.fn(), parse: jest.fn() },
    saveMusicPlayer: jest.fn().mockResolvedValue(undefined),
    deleteMusicPlayer: jest.fn().mockResolvedValue(undefined),
    getMusicPlayer: jest.fn().mockResolvedValue(undefined),
    getSavedSessionId: jest.fn().mockResolvedValue(undefined),
    saveSessionId: jest.fn().mockResolvedValue(undefined),
}));

const mockLogger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
jest.mock('../../utils/log', () => ({ scope: () => mockLogger }));

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

        // Mirrors updateSession() throwing "not ready" when node.sessionId isn't set yet.
        const node: any = {
            id: 'main',
            sessionId: undefined,
            updateSession: jest.fn().mockImplementation(function (this: any) {
                if (!this.sessionId) return Promise.reject(new Error('the Lavalink-Node is either not ready, or not up to date!'));
                return Promise.resolve(undefined);
            }),
        };
        fakeManager.nodeManager.emit('raw', node, { op: 'ready', sessionId: 'new-session-id', resumed: false });
        await Promise.resolve();

        expect(node.sessionId).toBe('new-session-id');
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

    describe('trackError', () => {
        const player = { guildId: 'g1', textChannelId: 'tc1' };

        function clientWithChannel(send: jest.Mock) {
            const client = makeClient();
            client.channels.cache.set('tc1', { send });
            return client;
        }

        test('tells the text channel which track failed and why, without pinging anyone', async () => {
            const send = jest.fn().mockResolvedValue(undefined);
            const lavalinkHandler = require('../../handlers/lavalinkHandler');
            await lavalinkHandler(clientWithChannel(send));

            fakeManager.emit('trackError', player, { info: { title: 'Song @everyone' } }, {
                exception: { severity: 'suspicious', message: 'All clients failed to load the item.', cause: 'Sign in to confirm you\'re not a bot' },
            });

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Track "Song @everyone" failed in guild "g1" (suspicious): All clients failed to load the item.')
            );
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("cause: Sign in to confirm you're not a bot"));
            expect(send).toHaveBeenCalledTimes(1);
            expect(send).toHaveBeenCalledWith({
                content: "Couldn't play **Song @everyone**: All clients failed to load the item.",
                allowedMentions: { parse: [] },
            });
        });

        test('falls back to the payload track and a plain message when the exception has no detail', async () => {
            const send = jest.fn().mockResolvedValue(undefined);
            const lavalinkHandler = require('../../handlers/lavalinkHandler');
            await lavalinkHandler(clientWithChannel(send));

            fakeManager.emit('trackError', player, null, { track: { info: { title: 'From payload' } }, error: 'boom' });

            expect(send).toHaveBeenCalledWith(expect.objectContaining({ content: "Couldn't play **From payload**." }));
        });

        test('does not throw when the text channel is gone or the send is rejected', async () => {
            const lavalinkHandler = require('../../handlers/lavalinkHandler');

            await lavalinkHandler(makeClient());
            expect(() => fakeManager.emit('trackError', player, { info: { title: 'Song' } }, {})).not.toThrow();

            const send = jest.fn().mockRejectedValue(new Error('Missing Access'));
            await lavalinkHandler(clientWithChannel(send));
            fakeManager.emit('trackError', player, { info: { title: 'Song' } }, {});
            await new Promise((resolve) => setImmediate(resolve));

            expect(send).toHaveBeenCalled();
        });
    });
});
