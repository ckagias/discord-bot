const shuffle = require('../../../slashCommands/music/shuffle');

function makeInteraction({ memberChannelId = 'vc1' as string | null } = {}) {
    return { guild: { id: 'g1' }, member: { voice: { channelId: memberChannelId } }, reply: jest.fn().mockResolvedValue({}) };
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

    test('rejects someone who is not in a voice channel, without touching the player', async () => {
        const interaction = makeInteraction({ memberChannelId: null });
        const player = { voiceChannelId: 'vc1', queue: { current: {}, tracks: [{}, {}, {}], shuffle: jest.fn() } };

        await shuffle.execute(interaction, makeClient(player));

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You need to be in a voice channel to control the music.' })
        );
        expect(player.queue.shuffle).not.toHaveBeenCalled();
    });

    test('rejects someone in a different voice channel than the bot, without touching the player', async () => {
        const interaction = makeInteraction({ memberChannelId: 'vc2' });
        const player = { voiceChannelId: 'vc1', queue: { current: {}, tracks: [{}, {}, {}], shuffle: jest.fn() } };

        await shuffle.execute(interaction, makeClient(player));

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('<#vc1>') })
        );
        expect(player.queue.shuffle).not.toHaveBeenCalled();
    });
});
