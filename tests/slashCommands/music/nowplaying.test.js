const nowplaying = require('../../../slashCommands/music/nowplaying');

function makeInteraction() {
    return { guild: { id: 'g1' }, reply: jest.fn().mockResolvedValue({}) };
}

function makeClient(player) {
    return { lavalink: { getPlayer: jest.fn().mockReturnValue(player) }, user: { displayAvatarURL: jest.fn().mockReturnValue('https://example.com/bot.png') } };
}

describe('nowplaying command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when nothing is playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient(null);

        await nowplaying.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Nothing is playing') })
        );
    });

    test('shows track info with a progress bar for a normal track', async () => {
        const interaction = makeInteraction();
        const player = {
            position: 30000,
            queue: { current: { info: { title: 'Song', uri: 'u', author: 'A', duration: 60000, isStream: false, artworkUrl: null }, requester: 'user1' } },
        };
        const client = makeClient(player);

        await nowplaying.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('shows LIVE for a stream instead of a progress bar', async () => {
        const interaction = makeInteraction();
        const player = {
            position: 0,
            queue: { current: { info: { title: 'Live Stream', uri: 'u', author: 'A', duration: 0, isStream: true, artworkUrl: null }, requester: 'user1' } },
        };
        const client = makeClient(player);

        await expect(nowplaying.execute(interaction, client)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports failure when building the embed throws', async () => {
        const interaction = makeInteraction();
        const player = { queue: { current: { info: { title: 'Song', isStream: false } } } };
        Object.defineProperty(player, 'position', { get() { throw new Error('boom'); } });
        const client = makeClient(player);

        await nowplaying.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to fetch track info') })
        );
    });
});
