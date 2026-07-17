const help = require('../../../slashCommands/info/help');

describe('help command', () => {
    test('replies with a bot info embed', async () => {
        const interaction = {
            client: {
                user: {
                    username: 'TestBot',
                    displayAvatarURL: jest.fn().mockReturnValue('https://example.com/bot.png'),
                    createdAt: new Date('2020-01-01'),
                    createdTimestamp: new Date('2020-01-01').getTime(),
                },
            },
            user: { tag: 'User#0001', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/user.png') },
            reply: jest.fn().mockResolvedValue({}),
        };

        await help.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
