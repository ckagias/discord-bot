const slowmode = require('../../../slashCommands/utility/slowmode');

function makeInteraction({ seconds = 60 } = {}) {
    return {
        options: { getInteger: jest.fn().mockReturnValue(seconds) },
        channel: { setRateLimitPerUser: jest.fn().mockResolvedValue({}) },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('slowmode command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('disables slowmode when set to 0', async () => {
        const interaction = makeInteraction({ seconds: 0 });

        await slowmode.execute(interaction);

        expect(interaction.channel.setRateLimitPerUser).toHaveBeenCalledWith(0);
        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('disabled'));
    });

    test('formats minutes and seconds correctly', async () => {
        const interaction = makeInteraction({ seconds: 90 });

        await slowmode.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('1 minute 30 seconds'));
    });

    test('formats a whole minute without a seconds part', async () => {
        const interaction = makeInteraction({ seconds: 120 });

        await slowmode.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('2 minutes'));
        expect(interaction.reply).not.toHaveBeenCalledWith(expect.stringContaining('0 seconds'));
    });

    test('reports failure when setting slowmode throws', async () => {
        const interaction = makeInteraction({ seconds: 30 });
        (interaction.channel.setRateLimitPerUser as jest.Mock).mockRejectedValue(new Error('missing permission'));

        await expect(slowmode.execute(interaction)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to set slowmode') })
        );
    });
});
