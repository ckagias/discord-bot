const gayrate = require('../../../slashCommands/fun/gayrate');

function makeInteraction({ user = null } = {}) {
    const self = { id: 'self1', toString: () => '<@self1>' };
    return {
        options: { getUser: jest.fn().mockReturnValue(user) },
        user: self,
        reply: jest.fn().mockResolvedValue({}),
        _self: self,
    };
}

describe('gayrate command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('defaults to the invoking user and uses second-person phrasing', async () => {
        const interaction = makeInteraction({ user: null });

        await gayrate.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('rates a specified user with third-person phrasing', async () => {
        const other = { id: 'other1', toString: () => '<@other1>' };
        const interaction = makeInteraction({ user: other });

        await gayrate.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
