jest.mock('axios');

const axios = require('axios');
const lyrics = require('../../../slashCommands/music/lyrics');

function makeTrack() {
    return { info: { title: 'Song (Official Video)', uri: 'http://x', author: 'Artist', artworkUrl: null } };
}

function makeInteraction() {
    return {
        guild: { id: 'g1' },
        user: { id: 'user1' },
        reply: jest.fn().mockResolvedValue({}),
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

function makeClient(player) {
    return { lavalink: { getPlayer: jest.fn().mockReturnValue(player) }, user: { displayAvatarURL: jest.fn().mockReturnValue('https://example.com/bot.png') } };
}

describe('lyrics command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when nothing is playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient(null);

        await lyrics.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Nothing is playing') })
        );
    });

    test('reports when no lyrics are found via either lookup method', async () => {
        const interaction = makeInteraction();
        const player = { queue: { current: makeTrack() } };
        const client = makeClient(player);
        axios.get.mockRejectedValueOnce({ response: { status: 404 } });
        axios.get.mockResolvedValueOnce({ data: [] });

        await lyrics.execute(interaction, client);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("Couldn't find lyrics") })
        );
    });

    test('shows a single-page embed with no pagination when lyrics are short', async () => {
        const interaction = makeInteraction();
        const player = { queue: { current: makeTrack() } };
        const client = makeClient(player);
        axios.get.mockResolvedValueOnce({ data: { plainLyrics: 'La la la' } });

        await lyrics.execute(interaction, client);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
        const call = interaction.editReply.mock.calls[0][0];
        expect(call.components).toBeUndefined();
    });

    test('falls back to search when the structured lookup 404s', async () => {
        const interaction = makeInteraction();
        const player = { queue: { current: makeTrack() } };
        const client = makeClient(player);
        axios.get.mockRejectedValueOnce({ response: { status: 404 } });
        axios.get.mockResolvedValueOnce({ data: [{ plainLyrics: 'Fallback lyrics' }] });

        await lyrics.execute(interaction, client);

        expect(axios.get).toHaveBeenCalledTimes(2);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('paginates long lyrics with prev/next buttons and starts a collector', async () => {
        const interaction = makeInteraction();
        const player = { queue: { current: makeTrack() } };
        const client = makeClient(player);
        const longLyrics = Array.from({ length: 200 }, (_, i) => `line ${i} `.repeat(30)).join('\n');
        axios.get.mockResolvedValueOnce({ data: { plainLyrics: longLyrics } });

        const response = { createMessageComponentCollector: jest.fn().mockReturnValue({ on: jest.fn() }) };
        interaction.editReply.mockResolvedValue(response);

        await lyrics.execute(interaction, client);

        const call = interaction.editReply.mock.calls[0][0];
        expect(call.components).toEqual(expect.any(Array));
        expect(response.createMessageComponentCollector).toHaveBeenCalled();
    });

    test('reports failure gracefully when the lyrics API throws unexpectedly', async () => {
        const interaction = makeInteraction();
        const player = { queue: { current: makeTrack() } };
        const client = makeClient(player);
        axios.get.mockRejectedValueOnce(new Error('network error'));

        await expect(lyrics.execute(interaction, client)).resolves.not.toThrow();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to fetch lyrics') })
        );
    });
});
