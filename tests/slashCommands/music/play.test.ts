jest.mock('../../../utils/music', () => {
    const actual = jest.requireActual('../../../utils/music');
    return {
        ...actual,
        resolveSpotifyTrackQuery: jest.fn(),
    };
});

const { resolveSpotifyTrackQuery } = require('../../../utils/music');
const play = require('../../../slashCommands/music/play');

function makePlayer(overrides: Record<string, unknown> = {}) {
    return {
        connected: true,
        connect: jest.fn().mockResolvedValue({}),
        playing: false,
        queue: { add: jest.fn() },
        search: jest.fn(),
        play: jest.fn().mockResolvedValue({}),
        ...overrides,
    };
}

function makeInteraction({ query = 'some song', voiceChannel = { id: 'vc1' }, botVoiceChannel = null }: { query?: string; voiceChannel?: any; botVoiceChannel?: any } = {}) {
    return {
        member: { voice: { channel: voiceChannel } },
        options: { getString: jest.fn().mockReturnValue(query) },
        guild: { id: 'g1', members: { me: { voice: { channel: botVoiceChannel } } } },
        channel: { id: 'chan1' },
        user: { id: 'user1', tag: 'User#0001' },
        reply: jest.fn().mockResolvedValue({}),
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

function makeClient(player: unknown) {
    return {
        lavalink: {
            getPlayer: jest.fn().mockReturnValue(null),
            createPlayer: jest.fn().mockReturnValue(player),
        },
        user: { displayAvatarURL: jest.fn().mockReturnValue('https://example.com/bot.png') },
    };
}

describe('play command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when the user is not in a voice channel', async () => {
        const interaction = makeInteraction({ voiceChannel: null });
        const client = makeClient(makePlayer());

        await play.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('voice channel first') })
        );
    });

    test('rejects when the bot is already playing in a different voice channel', async () => {
        const interaction = makeInteraction({ voiceChannel: { id: 'vc1' }, botVoiceChannel: { id: 'vc2' } });
        const client = makeClient(makePlayer());

        await play.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('different voice channel') })
        );
    });

    test('rejects unsupported Spotify album/playlist/artist links', async () => {
        const interaction = makeInteraction({ query: 'https://open.spotify.com/playlist/abc123' });
        const client = makeClient(makePlayer());

        await play.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("aren't supported yet") })
        );
    });

    test('rejects when a Spotify track link fails to resolve', async () => {
        const interaction = makeInteraction({ query: 'https://open.spotify.com/track/abc123' });
        const client = makeClient(makePlayer());
        resolveSpotifyTrackQuery.mockResolvedValue(null);

        await play.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Could not resolve that Spotify link') })
        );
    });

    test('resolves a Spotify track link into a search query and searches without the URL flag', async () => {
        const interaction = makeInteraction({ query: 'https://open.spotify.com/track/abc123' });
        const player = makePlayer({
            search: jest.fn().mockResolvedValue({ loadType: 'search', tracks: [{ info: { title: 'T', uri: 'u', author: 'A', duration: 1000 } }] }),
        });
        const client = makeClient(player);
        resolveSpotifyTrackQuery.mockResolvedValue('Song Name Artist');

        await play.execute(interaction, client);

        expect(player.search).toHaveBeenCalledWith({ query: 'Song Name Artist', source: 'ytsearch' }, interaction.user);
    });

    test('creates a new player and connects when none exists', async () => {
        const interaction = makeInteraction();
        const player = makePlayer({
            connected: false,
            search: jest.fn().mockResolvedValue({ loadType: 'search', tracks: [{ info: { title: 'T', uri: 'u', author: 'A', duration: 1000 } }] }),
        });
        const client = makeClient(player);

        await play.execute(interaction, client);

        expect(client.lavalink.createPlayer).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: 'g1', voiceChannelId: 'vc1', textChannelId: 'chan1' })
        );
        expect(player.connect).toHaveBeenCalled();
    });

    test('reuses an existing connected player without reconnecting', async () => {
        const interaction = makeInteraction();
        const player = makePlayer({
            search: jest.fn().mockResolvedValue({ loadType: 'search', tracks: [{ info: { title: 'T', uri: 'u', author: 'A', duration: 1000 } }] }),
        });
        const client = makeClient(player);
        client.lavalink.getPlayer.mockReturnValue(player);

        await play.execute(interaction, client);

        expect(client.lavalink.createPlayer).not.toHaveBeenCalled();
        expect(player.connect).not.toHaveBeenCalled();
    });

    test('reports no results for empty/error load types', async () => {
        const interaction = makeInteraction();
        const player = makePlayer({ search: jest.fn().mockResolvedValue({ loadType: 'empty' }) });
        const client = makeClient(player);

        await play.execute(interaction, client);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'No results found for that query.' })
        );
    });

    test('queues an entire playlist and reports track count', async () => {
        const interaction = makeInteraction();
        const tracks = [{ info: { title: 'A' } }, { info: { title: 'B' } }];
        const player = makePlayer({
            search: jest.fn().mockResolvedValue({ loadType: 'playlist', playlist: { name: 'My Mix' }, tracks }),
        });
        const client = makeClient(player);

        await play.execute(interaction, client);

        expect(player.queue.add).toHaveBeenCalledTimes(2);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
        expect(player.play).toHaveBeenCalled();
    });

    test('queues a single track and starts playback when idle', async () => {
        const interaction = makeInteraction();
        const track = { info: { title: 'Song', uri: 'http://x', author: 'Artist', duration: 60000, artworkUrl: null } };
        const player = makePlayer({ playing: false, search: jest.fn().mockResolvedValue({ loadType: 'search', tracks: [track] }) });
        const client = makeClient(player);

        await play.execute(interaction, client);

        expect(player.queue.add).toHaveBeenCalledWith(track);
        expect(player.play).toHaveBeenCalled();
    });

    test('does not call play again if the player is already playing', async () => {
        const interaction = makeInteraction();
        const track = { info: { title: 'Song', uri: 'http://x', author: 'Artist', duration: 60000 } };
        const player = makePlayer({ playing: true, search: jest.fn().mockResolvedValue({ loadType: 'search', tracks: [track] }) });
        const client = makeClient(player);

        await play.execute(interaction, client);

        expect(player.play).not.toHaveBeenCalled();
    });

    test('reports a service-unavailable message when Lavalink throws', async () => {
        const interaction = makeInteraction();
        const player = makePlayer({ search: jest.fn().mockRejectedValue(new Error('lavalink down')) });
        const client = makeClient(player);

        await expect(play.execute(interaction, client)).resolves.not.toThrow();

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Music service is unavailable') })
        );
    });
});
