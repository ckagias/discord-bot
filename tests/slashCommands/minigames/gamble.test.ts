jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const { getWallet, updateBalance } = require('../../../utils/economy');
const gamble = require('../../../slashCommands/minigames/gamble');

function makeCollector() {
    const handlers: Record<string, (...args: any[]) => any> = {};
    return { on: jest.fn((event, fn) => { handlers[event] = fn; }), handlers };
}

function makeInteraction({ amount = 100 } = {}) {
    const collector = makeCollector();
    const response = { createMessageComponentCollector: jest.fn().mockReturnValue(collector) };
    return {
        id: 'interaction1',
        options: { getInteger: jest.fn().mockReturnValue(amount) },
        user: { id: 'user1' },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue(response),
        _collector: collector,
    };
}

describe('gamble command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects a bet exceeding the balance', async () => {
        const interaction = makeInteraction({ amount: 1000 });
        getWallet.mockResolvedValue({ balance: 50 });

        await gamble.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("don't have enough credits") })
        );
    });

    test('shows the first roll with higher/lower buttons', async () => {
        const interaction = makeInteraction({ amount: 100 });
        getWallet.mockResolvedValue({ balance: 500 });
        jest.spyOn(Math, 'random').mockReturnValue(0.5);

        await gamble.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
        );
        (Math.random as jest.Mock).mockRestore();
    });

    test('does not reveal the first number before the player chooses', async () => {
        const interaction = makeInteraction({ amount: 100 });
        getWallet.mockResolvedValue({ balance: 500 });
        // 0.4 rolls 41, so the number would show up as "41" if it leaked into the prompt.
        jest.spyOn(Math, 'random').mockReturnValue(0.4);

        await gamble.execute(interaction);

        const { embeds } = interaction.editReply.mock.calls[0][0];
        const shown = JSON.stringify(embeds[0].toJSON());
        expect(shown).not.toMatch(/\b41\b/);
        expect(shown).toContain('hidden number');
        (Math.random as jest.Mock).mockRestore();
    });

    test('reveals both numbers in the result embed', async () => {
        const interaction = makeInteraction({ amount: 100 });
        getWallet.mockResolvedValue({ balance: 500 });
        const spy = jest.spyOn(Math, 'random').mockReturnValueOnce(0.1); // first = 11
        await gamble.execute(interaction);
        spy.mockReturnValue(0.9); // second = 91

        updateBalance.mockResolvedValue({ balance: 600 });
        const i = { customId: `gamble_interaction1_higher`, update: jest.fn().mockResolvedValue({}) };
        await interaction._collector.handlers.collect(i);

        const embed = i.update.mock.calls[0][0].embeds[0].toJSON();
        expect(embed.description).toContain('11');
        expect(embed.description).toContain('91');
        (Math.random as jest.Mock).mockRestore();
    });

    test('collect handler returns the bet on a tie', async () => {
        const interaction = makeInteraction({ amount: 100 });
        getWallet.mockResolvedValue({ balance: 500 });
        jest.spyOn(Math, 'random').mockReturnValue(0.5);
        await gamble.execute(interaction);

        const i = { customId: `gamble_interaction1_higher`, update: jest.fn().mockResolvedValue({}) };
        await interaction._collector.handlers.collect(i);

        expect(i.update).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('tie') })
        );
        (Math.random as jest.Mock).mockRestore();
    });

    test('collect handler pays out on a win', async () => {
        const interaction = makeInteraction({ amount: 100 });
        getWallet.mockResolvedValue({ balance: 500 });
        // First random() picks firstNumber; must differ from the second call inside collect.
        const spy = jest.spyOn(Math, 'random').mockReturnValueOnce(0.1);
        await gamble.execute(interaction);
        spy.mockReturnValue(0.9);

        updateBalance.mockResolvedValue({ balance: 600 });
        const i = { customId: `gamble_interaction1_higher`, update: jest.fn().mockResolvedValue({}) };
        await interaction._collector.handlers.collect(i);

        expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', 100);
        (Math.random as jest.Mock).mockRestore();
    });

    test('collect handler deducts on a loss', async () => {
        const interaction = makeInteraction({ amount: 100 });
        getWallet.mockResolvedValue({ balance: 500 });
        const spy = jest.spyOn(Math, 'random').mockReturnValueOnce(0.9);
        await gamble.execute(interaction);
        spy.mockReturnValue(0.1);

        updateBalance.mockResolvedValue({ balance: 400 });
        const i = { customId: `gamble_interaction1_higher`, update: jest.fn().mockResolvedValue({}) };
        await interaction._collector.handlers.collect(i);

        expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', -100);
        (Math.random as jest.Mock).mockRestore();
    });
});
