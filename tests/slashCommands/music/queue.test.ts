const queue = require('../../../slashCommands/music/queue');

function makeTrack(title: string, duration = 60000) {
    return { info: { title, author: 'Artist', duration, uri: 'http://x', isStream: false } };
}

function makeInteraction({ page = null } = {}) {
    return {
        options: { getInteger: jest.fn().mockReturnValue(page) },
        guild: { id: 'g1' },
        reply: jest.fn().mockResolvedValue({}),
    };
}

function makeClient(player: unknown) {
    return { lavalink: { getPlayer: jest.fn().mockReturnValue(player) }, user: { displayAvatarURL: jest.fn().mockReturnValue('https://example.com/bot.png') } };
}

describe('queue command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when nothing is playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient(null);

        await queue.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Nothing is playing right now.' })
        );
    });

    test('rejects a page number beyond the available range', async () => {
        const interaction = makeInteraction({ page: 5 });
        const player = { queue: { current: makeTrack('Now'), tracks: [makeTrack('A')] } };
        const client = makeClient(player);

        await queue.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("doesn't exist") })
        );
    });

    test('shows the current track and upcoming queue', async () => {
        const interaction = makeInteraction();
        const player = { queue: { current: makeTrack('Now'), tracks: [makeTrack('A'), makeTrack('B')] } };
        const client = makeClient(player);

        await queue.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports failure if building the queue embed throws', async () => {
        const interaction = makeInteraction();
        const player = { queue: { current: makeTrack('Now') } };
        Object.defineProperty(player.queue, 'tracks', { get() { throw new Error('boom'); } });
        const client = makeClient(player);

        await queue.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to fetch queue') })
        );
    });
});
