jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const { getWallet, updateBalance } = require('../../../utils/economy');
const rps = require('../../../slashCommands/minigames/rps');

function makeCollector() {
    const handlers: Record<string, (...args: any[]) => any> = {};
    return { on: jest.fn((event, fn) => { handlers[event] = fn; }), handlers };
}

function makeInteraction({ amount = null, opponent = null } = {}) {
    const collector = makeCollector();
    const response = { createMessageComponentCollector: jest.fn().mockReturnValue(collector) };
    return {
        id: 'interaction1',
        options: {
            getInteger: jest.fn().mockReturnValue(amount),
            getUser: jest.fn().mockReturnValue(opponent),
        },
        user: { id: 'user1', username: 'User' },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue(response),
        _collector: collector,
    };
}

describe('rps command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        updateBalance.mockResolvedValue({ balance: 400 }); // a bet is taken up front
    });

    describe('vs bot mode', () => {
        test('rejects a bet exceeding the balance', async () => {
            const interaction = makeInteraction({ amount: 1000 });
            getWallet.mockResolvedValue({ balance: 50 });

            await rps.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("don't have enough credits") })
            );
            expect(updateBalance).not.toHaveBeenCalled();
        });

        test('shows the move-selection buttons', async () => {
            const interaction = makeInteraction();

            await rps.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
            );
            expect(updateBalance).not.toHaveBeenCalled();
        });

        test('takes the bet before showing the move buttons', async () => {
            const interaction = makeInteraction({ amount: 100 });
            getWallet.mockResolvedValue({ balance: 500 });

            await rps.execute(interaction);

            expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', -100);
            expect(updateBalance.mock.invocationCallOrder[0]).toBeLessThan(interaction.editReply.mock.invocationCallOrder[0]);
        });

        test('does not start the game when the bet cannot be taken', async () => {
            const interaction = makeInteraction({ amount: 100 });
            getWallet.mockResolvedValue({ balance: 500 }); // looked affordable, but the balance was spent before the debit
            updateBalance.mockResolvedValue(null);

            await rps.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledTimes(1);
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'You no longer have enough credits to cover that bet.' })
            );
            expect(interaction._collector.on).not.toHaveBeenCalled();
        });

        test('collect handler resolves a win against the bot with no bet', async () => {
            const interaction = makeInteraction();
            await rps.execute(interaction);
            jest.spyOn(Math, 'random').mockReturnValue(0); // bot picks 'rock' (index 0)
            getWallet.mockResolvedValue({ balance: 500 });

            const i = { customId: 'rps_interaction1_paper', update: jest.fn().mockResolvedValue({}) };
            await interaction._collector.handlers.collect(i);

            expect(i.update).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array), components: [] })
            );
            (Math.random as jest.Mock).mockRestore();
        });

        test('collect handler pays out on a win with a bet', async () => {
            const interaction = makeInteraction({ amount: 100 });
            getWallet.mockResolvedValue({ balance: 500 });
            await rps.execute(interaction);
            jest.spyOn(Math, 'random').mockReturnValue(0); // bot picks 'rock'
            updateBalance.mockResolvedValue({ balance: 600 });

            const i = { customId: 'rps_interaction1_paper', update: jest.fn().mockResolvedValue({}) };
            await interaction._collector.handlers.collect(i);

            expect(updateBalance).toHaveBeenLastCalledWith('user1', 'g1', 200); // the held bet plus the winnings
            (Math.random as jest.Mock).mockRestore();
        });

        test('collect handler keeps the held bet on a loss without charging again', async () => {
            const interaction = makeInteraction({ amount: 100 });
            getWallet.mockResolvedValue({ balance: 500 });
            await rps.execute(interaction);
            jest.spyOn(Math, 'random').mockReturnValue(0); // bot picks 'rock'
            getWallet.mockResolvedValue({ balance: 400 });

            const i = { customId: 'rps_interaction1_scissors', update: jest.fn().mockResolvedValue({}) };
            await interaction._collector.handlers.collect(i);

            expect(updateBalance).toHaveBeenCalledTimes(1); // only the hold
            expect(JSON.stringify(i.update.mock.calls[0][0].embeds[0].toJSON())).toContain('-100 → 💳 400');
            (Math.random as jest.Mock).mockRestore();
        });

        test('collect handler gives the bet back on a tie', async () => {
            const interaction = makeInteraction({ amount: 100 });
            getWallet.mockResolvedValue({ balance: 500 });
            await rps.execute(interaction);
            jest.spyOn(Math, 'random').mockReturnValue(0); // bot picks 'rock'
            updateBalance.mockResolvedValue({ balance: 500 });

            const i = { customId: 'rps_interaction1_rock', update: jest.fn().mockResolvedValue({}) };
            await interaction._collector.handlers.collect(i);

            expect(updateBalance).toHaveBeenLastCalledWith('user1', 'g1', 100);
            (Math.random as jest.Mock).mockRestore();
        });

        test('refunds the bet and says so when the time runs out', async () => {
            const interaction = makeInteraction({ amount: 100 });
            getWallet.mockResolvedValue({ balance: 500 });
            await rps.execute(interaction);

            await interaction._collector.handlers.end({ size: 0 }, 'time');

            expect(updateBalance).toHaveBeenLastCalledWith('user1', 'g1', 100);
            expect(interaction.editReply).toHaveBeenLastCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Time is up') })
            );
        });

        test('refunds the bet when the game ends without a move for another reason', async () => {
            const interaction = makeInteraction({ amount: 100 });
            getWallet.mockResolvedValue({ balance: 500 });
            await rps.execute(interaction);
            const repliesBefore = interaction.editReply.mock.calls.length;

            await interaction._collector.handlers.end({ size: 0 }, 'messageDelete');

            expect(updateBalance).toHaveBeenLastCalledWith('user1', 'g1', 100);
            expect(interaction.editReply).toHaveBeenCalledTimes(repliesBefore);
        });

        test('does not refund after a move, or when there was no bet', async () => {
            const withBet = makeInteraction({ amount: 100 });
            getWallet.mockResolvedValue({ balance: 500 });
            await rps.execute(withBet);
            updateBalance.mockClear();
            await withBet._collector.handlers.end({ size: 1 }, 'limit');

            const noBet = makeInteraction();
            await rps.execute(noBet);
            await noBet._collector.handlers.end({ size: 0 }, 'time');

            expect(updateBalance).not.toHaveBeenCalled();
        });
    });

    describe('pvp mode', () => {
        test('rejects challenging a bot', async () => {
            const interaction = makeInteraction({ opponent: { id: 'bot1', bot: true } });

            await rps.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'You cannot challenge a bot.' })
            );
        });

        test('rejects challenging yourself', async () => {
            const interaction = makeInteraction({ opponent: { id: 'user1', bot: false } });

            await rps.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'You cannot challenge yourself.' })
            );
        });

        test('rejects an unaffordable bet before sending the challenge', async () => {
            const interaction = makeInteraction({ amount: 1000, opponent: { id: 'target1', bot: false } });
            getWallet.mockResolvedValue({ balance: 50 });

            await rps.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("don't have enough credits") })
            );
        });

        test('posts a challenge without requiring a bet', async () => {
            const interaction = makeInteraction({ opponent: { id: 'target1', bot: false, username: 'Target' } });

            await rps.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
            );
        });
    });
});
