const commands = require('../../../slashCommands/info/commands');

function makeCommand(name, category, description = 'desc') {
    return { category, data: { name, description } };
}

function makeInteraction(commandList) {
    return {
        client: {
            commands: new Map(commandList.map((c) => [c.data.name, c])),
            user: { displayAvatarURL: jest.fn().mockReturnValue('https://example.com/bot.png') },
        },
        user: { tag: 'User#0001', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/user.png') },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('commands command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('groups commands by category and replies ephemerally', async () => {
        const interaction = makeInteraction([
            makeCommand('ban', 'moderation'),
            makeCommand('daily', 'economy'),
        ]);

        await commands.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), flags: expect.any(Number) })
        );
    });

    test('splits a category into multiple fields when it exceeds the 1024-char embed field limit', async () => {
        const longCommandList = Array.from({ length: 50 }, (_, i) =>
            makeCommand(`cmd${i}`, 'utility', 'a fairly long description to pad out the field length nicely')
        );
        const interaction = makeInteraction(longCommandList);

        await commands.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('defaults commands without a category to "other"', async () => {
        const interaction = makeInteraction([{ data: { name: 'mystery', description: 'desc' } }]);

        await expect(commands.execute(interaction)).resolves.not.toThrow();
    });
});
