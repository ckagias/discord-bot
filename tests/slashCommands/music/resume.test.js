const resume = require('../../../slashCommands/music/resume');

function makeInteraction() {
    return { guild: { id: 'g1' }, reply: jest.fn().mockResolvedValue({}) };
}

function makeClient(player) {
    return { lavalink: { getPlayer: jest.fn().mockReturnValue(player) } };
}

describe('resume command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when nothing is playing', async () => {
        const interaction = makeInteraction();
        const client = makeClient(null);

        await resume.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Nothing is playing right now.' })
        );
    });

    test('rejects when the player is not paused', async () => {
        const interaction = makeInteraction();
        const client = makeClient({ paused: false });

        await resume.execute(interaction, client);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('not paused') })
        );
    });

    test('resumes playback', async () => {
        const interaction = makeInteraction();
        const player = { paused: true, resume: jest.fn().mockResolvedValue({}) };
        const client = makeClient(player);

        await resume.execute(interaction, client);

        expect(player.resume).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports failure when resuming throws', async () => {
        const interaction = makeInteraction();
        const player = { paused: true, resume: jest.fn().mockRejectedValue(new Error('fail')) };
        const client = makeClient(player);

        await expect(resume.execute(interaction, client)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to resume') })
        );
    });
});
