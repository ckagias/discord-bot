const skipto = require('../../../slashCommands/music/skipto');

function makeInteraction({ position = 2, memberChannelId = 'vc1' as string | null } = {}) {
    return {
        options: { getInteger: jest.fn().mockReturnValue(position) },
        guild: { id: 'g1' },
        member: { voice: { channelId: memberChannelId } },
        reply: jest.fn().mockResolvedValue({}),
    };
}

function makeClient(player: unknown) {
    return { lavalink: { getPlayer: jest.fn().mockReturnValue(player) } };
}

describe('skipto command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when nothing is playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient(null);

        await skipto.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Nothing is playing right now.' })
        );
    });

    test('rejects a position beyond the queue length', async () => {
        const interaction = makeInteraction({ position: 9 });
        const player = { queue: { current: { info: {} }, tracks: [{ info: { title: 'A' } }] }, skip: jest.fn() };
        const client = makeClient(player);

        await skipto.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("doesn't exist") })
        );
        expect(player.skip).not.toHaveBeenCalled();
    });

    test('skips to the given position', async () => {
        const interaction = makeInteraction({ position: 2 });
        const tracks = [{ info: { title: 'A' } }, { info: { title: 'B' } }];
        const player = { queue: { current: { info: {} }, tracks }, skip: jest.fn().mockResolvedValue({}) };
        const client = makeClient(player);

        await skipto.execute(interaction, client);

        expect(player.skip).toHaveBeenCalledWith(2);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports failure when skipping throws', async () => {
        const interaction = makeInteraction({ position: 1 });
        const player = { queue: { current: { info: {} }, tracks: [{ info: { title: 'A' } }] }, skip: jest.fn().mockRejectedValue(new Error('fail')) };
        const client = makeClient(player);

        await expect(skipto.execute(interaction, client)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to skip') })
        );
    });

    test('rejects someone who is not in a voice channel, without touching the player', async () => {
        const interaction = makeInteraction({ memberChannelId: null });
        const player = { voiceChannelId: 'vc1', queue: { current: {}, tracks: [{ info: { title: 'a' } }, { info: { title: 'b' } }] }, skip: jest.fn() };

        await skipto.execute(interaction, makeClient(player));

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You need to be in a voice channel to control the music.' })
        );
        expect(player.skip).not.toHaveBeenCalled();
    });

    test('rejects someone in a different voice channel than the bot, without touching the player', async () => {
        const interaction = makeInteraction({ memberChannelId: 'vc2' });
        const player = { voiceChannelId: 'vc1', queue: { current: {}, tracks: [{ info: { title: 'a' } }, { info: { title: 'b' } }] }, skip: jest.fn() };

        await skipto.execute(interaction, makeClient(player));

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('<#vc1>') })
        );
        expect(player.skip).not.toHaveBeenCalled();
    });
});
