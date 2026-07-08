const stop = require('../../../slashCommands/music/stop');

function makeInteraction() {
    return { guild: { id: 'g1' }, reply: jest.fn().mockResolvedValue({}) };
}

function makeClient(player) {
    return { lavalink: { getPlayer: jest.fn().mockReturnValue(player) } };
}

describe('stop command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when nothing is playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient(null);

        await stop.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Nothing is playing right now.' })
        );
    });

    test('flags a manual stop, clears the queue, and destroys the player', async () => {
        const interaction = makeInteraction();
        const player = {
            setData: jest.fn(),
            stopPlaying: jest.fn().mockResolvedValue({}),
            destroy: jest.fn().mockResolvedValue({}),
        };
        const client = makeClient(player);

        await stop.execute(interaction, client);

        expect(player.setData).toHaveBeenCalledWith('manual_stop', true);
        expect(player.stopPlaying).toHaveBeenCalledWith(true, true);
        expect(player.destroy).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports failure when stopping throws', async () => {
        const interaction = makeInteraction();
        const player = { setData: jest.fn(), stopPlaying: jest.fn().mockRejectedValue(new Error('fail')), destroy: jest.fn() };
        const client = makeClient(player);

        await expect(stop.execute(interaction, client)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to stop playback') })
        );
    });
});
