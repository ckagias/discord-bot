const ping = require('../../../slashCommands/info/ping');

describe('ping command', () => {
    test('replies with an embed showing api and bot latency', async () => {
        const interaction = {
            client: { ws: { ping: 42 } },
            createdTimestamp: Date.now() - 10,
            reply: jest.fn().mockResolvedValue({}),
        };

        await ping.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
