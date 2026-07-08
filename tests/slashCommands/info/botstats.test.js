const botstats = require('../../../slashCommands/info/botstats');

function makeCommand(category) {
    return { category };
}

function makeInteraction(commandList = []) {
    return {
        client: {
            commands: new Map(commandList.map((c, i) => [`cmd${i}`, c])),
            user: { username: 'TestBot', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/bot.png') },
            ws: { ping: 50 },
            uptime: 123456,
            lavalink: null,
        },
        user: { tag: 'User#0001', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/user.png') },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('botstats command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('replies with a stats embed', async () => {
        const interaction = makeInteraction([makeCommand('moderation'), makeCommand('economy')]);

        await botstats.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports N/A for the Lavalink version when no node is connected', async () => {
        const interaction = makeInteraction([]);

        await expect(botstats.execute(interaction)).resolves.not.toThrow();
    });

    test('reports the Lavalink version when a node is connected', async () => {
        const interaction = makeInteraction([]);
        interaction.client.lavalink = {
            nodeManager: { nodes: new Map([['node1', { info: { version: { semver: '4.0.0' } } }]]) },
        };

        await expect(botstats.execute(interaction)).resolves.not.toThrow();
    });
});
