const pause = require('../../../slashCommands/music/pause');

function makeInteraction() {
    return { guild: { id: 'g1' }, reply: jest.fn().mockResolvedValue({}) };
}

function makeClient(player) {
    return { lavalink: { getPlayer: jest.fn().mockReturnValue(player) } };
}

describe('pause command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when nothing is playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient(null);

        await pause.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Nothing is playing right now.' })
        );
    });

    test('rejects when the player exists but is not playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient({ playing: false });

        await pause.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Nothing is playing right now.' })
        );
    });

    test('rejects when already paused', async () => {
        const interaction = makeInteraction();
        const client = makeClient({ playing: true, paused: true });

        await pause.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('already paused') })
        );
    });

    test('pauses the player', async () => {
        const interaction = makeInteraction();
        const player = { playing: true, paused: false, pause: jest.fn().mockResolvedValue({}) };
        const client = makeClient(player);

        await pause.execute(interaction, client);

        expect(player.pause).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports failure when pausing throws', async () => {
        const interaction = makeInteraction();
        const player = { playing: true, paused: false, pause: jest.fn().mockRejectedValue(new Error('fail')) };
        const client = makeClient(player);

        await expect(pause.execute(interaction, client)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to pause') })
        );
    });
});
