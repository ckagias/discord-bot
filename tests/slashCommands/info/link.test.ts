const link = require('../../../slashCommands/info/link');

describe('link command', () => {
    test('generates an invite link and replies with it', async () => {
        const interaction = {
            client: {
                generateInvite: jest.fn().mockReturnValue('https://discord.com/invite/abc'),
                user: { displayAvatarURL: jest.fn().mockReturnValue('https://example.com/bot.png') },
            },
            reply: jest.fn().mockResolvedValue({}),
        };

        await link.execute(interaction);

        expect(interaction.client.generateInvite).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
