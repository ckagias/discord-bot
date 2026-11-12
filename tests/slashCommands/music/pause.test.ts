const pause = require('../../../slashCommands/music/pause');

function makeInteraction({ memberChannelId = 'vc1' as string | null } = {}) {
    return { guild: { id: 'g1' }, member: { voice: { channelId: memberChannelId } }, reply: jest.fn().mockResolvedValue({}) };
}

function makeClient(player: unknown) {
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

    test('rejects someone who is not in a voice channel, without touching the player', async () => {
        const interaction = makeInteraction({ memberChannelId: null });
        const player = { voiceChannelId: 'vc1', playing: true, paused: false, pause: jest.fn() };

        await pause.execute(interaction, makeClient(player));

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You need to be in a voice channel to control the music.' })
        );
        expect(player.pause).not.toHaveBeenCalled();
    });

    test('rejects someone in a different voice channel than the bot, without touching the player', async () => {
        const interaction = makeInteraction({ memberChannelId: 'vc2' });
        const player = { voiceChannelId: 'vc1', playing: true, paused: false, pause: jest.fn() };

        await pause.execute(interaction, makeClient(player));

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('<#vc1>') })
        );
        expect(player.pause).not.toHaveBeenCalled();
    });
});
