jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const { getWallet, updateBalance } = require('../../../utils/economy');
const rps = require('../../../slashCommands/minigames/rps');

function makeCollector() {
    const handlers = {};
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
    });

    describe('vs bot mode', () => {
        test('rejects a bet exceeding the balance', async () => {
            const interaction = makeInteraction({ amount: 1000 });
            getWallet.mockResolvedValue({ balance: 50 });

            await rps.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("don't have enough credits") })
            );
        });

        test('shows the move-selection buttons', async () => {
            const interaction = makeInteraction();

            await rps.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
            );
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
            Math.random.mockRestore();
        });

        test('collect handler pays out on a win with a bet', async () => {
            const interaction = makeInteraction({ amount: 100 });
            getWallet.mockResolvedValue({ balance: 500 });
            await rps.execute(interaction);
            jest.spyOn(Math, 'random').mockReturnValue(0); // bot picks 'rock'
            updateBalance.mockResolvedValue({ balance: 600 });

            const i = { customId: 'rps_interaction1_paper', update: jest.fn().mockResolvedValue({}) };
            await interaction._collector.handlers.collect(i);

            expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', 100);
            Math.random.mockRestore();
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
