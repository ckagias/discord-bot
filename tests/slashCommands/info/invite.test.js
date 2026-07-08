const invite = require('../../../slashCommands/info/invite');

describe('invite command', () => {
    test('creates a 7-day invite and replies with the link', async () => {
        const interaction = {
            channel: { createInvite: jest.fn().mockResolvedValue({ url: 'https://discord.gg/abc123' }) },
            guild: { name: 'Test Guild', iconURL: jest.fn().mockReturnValue('https://example.com/icon.png') },
            user: { tag: 'User#0001' },
            reply: jest.fn().mockResolvedValue({}),
        };

        await invite.execute(interaction);

        expect(interaction.channel.createInvite).toHaveBeenCalledWith(
            expect.objectContaining({ maxAge: 7 * 24 * 60 * 60, maxUses: 0 })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
