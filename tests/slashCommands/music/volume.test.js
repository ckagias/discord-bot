const volume = require('../../../slashCommands/music/volume');

function makeInteraction({ level = null } = {}) {
    return {
        options: { getInteger: jest.fn().mockReturnValue(level) },
        guild: { id: 'g1' },
        reply: jest.fn().mockResolvedValue({}),
    };
}

function makeClient(player) {
    return { lavalink: { getPlayer: jest.fn().mockReturnValue(player) } };
}

describe('volume command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when nothing is playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient(null);

        await volume.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Nothing is playing right now.' })
        );
    });

    test('reports the current volume when no level is given', async () => {
        const interaction = makeInteraction({ level: null });
        const client = makeClient({ volume: 75 });

        await volume.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('75%') })
        );
    });

    test('sets the volume when a level is given', async () => {
        const interaction = makeInteraction({ level: 50 });
        const player = { volume: 100, setVolume: jest.fn().mockResolvedValue({}) };
        const client = makeClient(player);

        await volume.execute(interaction, client);

        expect(player.setVolume).toHaveBeenCalledWith(50);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports failure when setting volume throws', async () => {
        const interaction = makeInteraction({ level: 50 });
        const player = { volume: 100, setVolume: jest.fn().mockRejectedValue(new Error('fail')) };
        const client = makeClient(player);

        await expect(volume.execute(interaction, client)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to set volume') })
        );
    });
});
