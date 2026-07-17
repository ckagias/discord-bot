const loop = require('../../../slashCommands/music/loop');

function makeInteraction({ mode = 'track' } = {}) {
    return {
        options: { getString: jest.fn().mockReturnValue(mode) },
        guild: { id: 'g1' },
        reply: jest.fn().mockResolvedValue({}),
    };
}

function makeClient(player: unknown) {
    return { lavalink: { getPlayer: jest.fn().mockReturnValue(player) } };
}

describe('loop command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when nothing is playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient(null);

        await loop.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Nothing is playing right now.' })
        );
    });

    test.each(['off', 'track', 'queue'])('sets loop mode to %s', async (mode) => {
        const interaction = makeInteraction({ mode });
        const player = { setRepeatMode: jest.fn().mockResolvedValue({}) };
        const client = makeClient(player);

        await loop.execute(interaction, client);

        expect(player.setRepeatMode).toHaveBeenCalledWith(mode);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports failure when setting loop mode throws', async () => {
        const interaction = makeInteraction();
        const player = { setRepeatMode: jest.fn().mockRejectedValue(new Error('fail')) };
        const client = makeClient(player);

        await expect(loop.execute(interaction, client)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to set loop mode') })
        );
    });
});
