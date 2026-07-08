const skip = require('../../../slashCommands/music/skip');

function makeInteraction() {
    return { guild: { id: 'g1' }, reply: jest.fn().mockResolvedValue({}) };
}

function makeClient(player) {
    return { lavalink: { getPlayer: jest.fn().mockReturnValue(player) } };
}

describe('skip command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when nothing is playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient(null);

        await skip.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Nothing is playing right now.' })
        );
    });

    test('stops playback entirely when the queue is empty after the current track', async () => {
        const interaction = makeInteraction();
        const player = {
            playing: true,
            queue: { current: { info: { title: 'Song' } }, tracks: [] },
            stopPlaying: jest.fn().mockResolvedValue({}),
            skip: jest.fn(),
        };
        const client = makeClient(player);

        await skip.execute(interaction, client);

        expect(player.stopPlaying).toHaveBeenCalledWith(false, false);
        expect(player.skip).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('skips to the next track when the queue has more tracks', async () => {
        const interaction = makeInteraction();
        const player = {
            playing: true,
            queue: { current: { info: { title: 'Song' } }, tracks: [{ info: { title: 'Next' } }] },
            stopPlaying: jest.fn(),
            skip: jest.fn().mockResolvedValue({}),
        };
        const client = makeClient(player);

        await skip.execute(interaction, client);

        expect(player.skip).toHaveBeenCalled();
        expect(player.stopPlaying).not.toHaveBeenCalled();
    });
});
