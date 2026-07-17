const membercount = require('../../../slashCommands/settings/membercount');

describe('membercount command', () => {
    test('replies with an embed showing the member count', async () => {
        const interaction = {
            guild: { name: 'Test Guild', memberCount: 42, iconURL: jest.fn().mockReturnValue('https://example.com/icon.png') },
            reply: jest.fn().mockResolvedValue({}),
        };

        await membercount.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
        expect(interaction.guild.iconURL).toHaveBeenCalledWith();
    });
});
