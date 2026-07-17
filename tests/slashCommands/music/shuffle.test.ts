const shuffle = require('../../../slashCommands/music/shuffle');

function makeInteraction() {
    return { guild: { id: 'g1' }, reply: jest.fn().mockResolvedValue({}) };
}

function makeClient(player: unknown) {
    return { lavalink: { getPlayer: jest.fn().mockReturnValue(player) } };
}

describe('shuffle command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when nothing is playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient(null);

        await shuffle.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Nothing is playing right now.' })
        );
    });

    test('rejects when fewer than 2 tracks are queued', async () => {
        const interaction = makeInteraction();
        const player = { queue: { current: { info: {} }, tracks: [{ info: {} }] } };
        const client = makeClient(player);

        await shuffle.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Not enough tracks') })
        );
    });

    test('shuffles the queue and reports the count', async () => {
        const interaction = makeInteraction();
        const player = { queue: { current: { info: {} }, tracks: [{ info: {} }, { info: {} }], shuffle: jest.fn().mockResolvedValue(2) } };
        const client = makeClient(player);

        await shuffle.execute(interaction, client);

        expect(player.queue.shuffle).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports failure when shuffling throws', async () => {
        const interaction = makeInteraction();
        const player = { queue: { current: { info: {} }, tracks: [{ info: {} }, { info: {} }], shuffle: jest.fn().mockRejectedValue(new Error('fail')) } };
        const client = makeClient(player);

        await expect(shuffle.execute(interaction, client)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to shuffle') })
        );
    });
});
