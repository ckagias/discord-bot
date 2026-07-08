jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const { getWallet, updateBalance } = require('../../../utils/economy');
const coinflip = require('../../../slashCommands/minigames/coinflip');

function makeCollector() {
    const handlers = {};
    return { on: jest.fn((event, fn) => { handlers[event] = fn; }), handlers };
}

function makeInteraction({ guess = null, amount = null, opponent = null } = {}) {
    const collector = makeCollector();
    const response = { createMessageComponentCollector: jest.fn().mockReturnValue(collector) };
    return {
        options: {
            getString: jest.fn().mockReturnValue(guess),
            getInteger: jest.fn().mockReturnValue(amount),
            getUser: jest.fn().mockReturnValue(opponent),
        },
        user: { id: 'user1', username: 'User' },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue(response),
        _collector: collector,
        _response: response,
    };
}

describe('coinflip command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        Math.random.mockRestore();
    });

    describe('vs bot mode', () => {
        test('flips without a bet and shows result plus balance', async () => {
            const interaction = makeInteraction({ guess: 'heads' });
            getWallet.mockResolvedValue({ balance: 500 });

            await coinflip.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
            expect(updateBalance).not.toHaveBeenCalled();
        });

        test('requires a guess when betting', async () => {
            const interaction = makeInteraction({ guess: null, amount: 100 });

            await coinflip.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('need to pick heads or tails') })
            );
        });

        test('rejects a bet exceeding the balance', async () => {
            const interaction = makeInteraction({ guess: 'heads', amount: 1000 });
            getWallet.mockResolvedValue({ balance: 50 });

            await coinflip.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("don't have enough credits") })
            );
        });

        test('pays out on a winning bet', async () => {
            const interaction = makeInteraction({ guess: 'heads', amount: 100 });
            getWallet.mockResolvedValue({ balance: 500 });
            updateBalance.mockResolvedValue({ balance: 600 });

            await coinflip.execute(interaction);

            expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', 100);
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });

        test('deducts on a losing bet', async () => {
            const interaction = makeInteraction({ guess: 'tails', amount: 100 });
            getWallet.mockResolvedValue({ balance: 500 });
            updateBalance.mockResolvedValue({ balance: 400 });

            await coinflip.execute(interaction);

            expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', -100);
        });
    });

    describe('pvp mode', () => {
        test('rejects challenging a bot', async () => {
            const interaction = makeInteraction({ amount: 100, opponent: { id: 'bot1', bot: true } });

            await coinflip.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'You cannot challenge a bot.' })
            );
        });

        test('rejects challenging yourself', async () => {
            const interaction = makeInteraction({ amount: 100, opponent: { id: 'user1', bot: false } });

            await coinflip.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'You cannot challenge yourself.' })
            );
        });

        test('requires a bet for pvp challenges', async () => {
            const interaction = makeInteraction({ amount: null, opponent: { id: 'target1', bot: false } });

            await coinflip.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('must set a bet') })
            );
        });

        test('rejects when the challenger cannot afford the bet', async () => {
            const interaction = makeInteraction({ amount: 500, opponent: { id: 'target1', bot: false } });
            getWallet.mockResolvedValue({ balance: 100 });

            await coinflip.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("don't have enough credits") })
            );
        });

        test('posts a challenge with accept/decline buttons when valid', async () => {
            const interaction = makeInteraction({ amount: 100, opponent: { id: 'target1', bot: false, username: 'Target' } });
            getWallet.mockResolvedValue({ balance: 500 });

            await coinflip.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
            );
            expect(interaction._response.createMessageComponentCollector).toHaveBeenCalled();
        });

        test('decline handler shows a declined embed', async () => {
            const interaction = makeInteraction({ amount: 100, opponent: { id: 'target1', bot: false, username: 'Target' } });
            getWallet.mockResolvedValue({ balance: 500 });
            await coinflip.execute(interaction);

            const i = { customId: 'cf_decline', update: jest.fn().mockResolvedValue({}) };
            await interaction._collector.handlers.collect(i);

            expect(i.update).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array), components: [] })
            );
        });

        test('accept handler refunds both sides if either debit fails', async () => {
            const interaction = makeInteraction({ guess: 'heads', amount: 100, opponent: { id: 'target1', bot: false, username: 'Target' } });
            getWallet.mockResolvedValueOnce({ balance: 500 }).mockResolvedValueOnce({ balance: 500 });
            await coinflip.execute(interaction);

            updateBalance
                .mockResolvedValueOnce({ balance: 400 })  // challenger debit succeeds
                .mockResolvedValueOnce(null);              // opponent debit fails

            const i = { customId: 'cf_accept', update: jest.fn().mockResolvedValue({}) };
            await interaction._collector.handlers.collect(i);

            expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', 100);
            expect(i.update).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Game cancelled and bets refunded') })
            );
        });

        test('accept handler resolves the game and pays the winner', async () => {
            const interaction = makeInteraction({ guess: 'heads', amount: 100, opponent: { id: 'target1', bot: false, username: 'Target' } });
            getWallet.mockResolvedValueOnce({ balance: 500 }).mockResolvedValueOnce({ balance: 500 });
            await coinflip.execute(interaction);

            updateBalance
                .mockResolvedValueOnce({ balance: 400 })
                .mockResolvedValueOnce({ balance: 400 })
                .mockResolvedValueOnce({ balance: 600 });

            const i = { customId: 'cf_accept', update: jest.fn().mockResolvedValue({}) };
            await interaction._collector.handlers.collect(i);

            expect(i.update).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array), components: [] })
            );
        });
    });
});
