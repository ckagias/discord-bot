jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const { getWallet } = require('../../../utils/economy');
const balance = require('../../../slashCommands/economy/balance');

function makeInteraction({ user = null } = {}) {
    return {
        options: { getUser: jest.fn().mockReturnValue(user) },
        user: { id: 'self1', username: 'Self', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png') },
        guild: { id: 'g1', name: 'Test Guild' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('balance command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('defaults to the invoking user when no user option is given', async () => {
        const interaction = makeInteraction({ user: null });
        getWallet.mockResolvedValue({ balance: 300 });

        await balance.execute(interaction);

        expect(getWallet).toHaveBeenCalledWith('self1', 'g1');
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('checks the specified user when a user option is given', async () => {
        const other = { id: 'other1', username: 'Other', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png') };
        const interaction = makeInteraction({ user: other });
        getWallet.mockResolvedValue({ balance: 900 });

        await balance.execute(interaction);

        expect(getWallet).toHaveBeenCalledWith('other1', 'g1');
    });

    test('shows no tax field for a balance at or below the threshold', async () => {
        const interaction = makeInteraction({ user: null });
        getWallet.mockResolvedValue({ balance: 10_000 });

        await balance.execute(interaction);

        const embed = interaction.editReply.mock.calls[0][0].embeds[0].toJSON();
        expect(embed.fields.map(f => f.name)).toEqual(['Balance']);
    });

    test('shows the next daily tax for a balance above the threshold', async () => {
        const interaction = makeInteraction({ user: null });
        getWallet.mockResolvedValue({ balance: 110_000 });

        await balance.execute(interaction);

        const embed = interaction.editReply.mock.calls[0][0].embeds[0].toJSON();
        const tax = embed.fields.find(f => f.name === 'Daily tax');
        expect(tax.value).toContain('2,000');
        expect(tax.value).toContain('2%');
        expect(tax.value).toContain('10,000');
    });

    test('shows no tax field when the excess is too small to be taxed', async () => {
        const interaction = makeInteraction({ user: null });
        getWallet.mockResolvedValue({ balance: 10_049 });

        await balance.execute(interaction);

        const embed = interaction.editReply.mock.calls[0][0].embeds[0].toJSON();
        expect(embed.fields.map(f => f.name)).toEqual(['Balance']);
    });
});
