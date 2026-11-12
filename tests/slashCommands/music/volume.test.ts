const volume = require('../../../slashCommands/music/volume');

function makeInteraction({ level = null, memberChannelId = 'vc1' as string | null } = {}) {
    return {
        options: { getInteger: jest.fn().mockReturnValue(level) },
        guild: { id: 'g1' },
        member: { voice: { channelId: memberChannelId } },
        reply: jest.fn().mockResolvedValue({}),
    };
}

function makeClient(player: unknown) {
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

    test('rejects someone who is not in a voice channel, without touching the player', async () => {
        const interaction = makeInteraction({ memberChannelId: null, level: 80 });
        const player = { voiceChannelId: 'vc1', volume: 50, setVolume: jest.fn() };

        await volume.execute(interaction, makeClient(player));

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You need to be in a voice channel to control the music.' })
        );
        expect(player.setVolume).not.toHaveBeenCalled();
    });

    test('rejects someone in a different voice channel than the bot, without touching the player', async () => {
        const interaction = makeInteraction({ memberChannelId: 'vc2', level: 80 });
        const player = { voiceChannelId: 'vc1', volume: 50, setVolume: jest.fn() };

        await volume.execute(interaction, makeClient(player));

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('<#vc1>') })
        );
        expect(player.setVolume).not.toHaveBeenCalled();
    });

    test('still lets anyone read the current volume without being in the voice channel', async () => {
        const interaction = makeInteraction({ memberChannelId: null });
        const player = { voiceChannelId: 'vc1', volume: 50, setVolume: jest.fn() };

        await volume.execute(interaction, makeClient(player));

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('50%') })
        );
    });
});
