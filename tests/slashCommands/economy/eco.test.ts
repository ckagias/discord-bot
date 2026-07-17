jest.mock('../../../models/EconomySchema', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const EconomySchema = require('../../../models/EconomySchema');
const { getWallet, updateBalance } = require('../../../utils/economy');
const eco = require('../../../slashCommands/economy/eco');

function makeInteraction({ sub, amount = 100 }: { sub?: string; amount?: number } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getUser: jest.fn().mockReturnValue({ id: 'target1', username: 'Target' }),
            getInteger: jest.fn().mockReturnValue(amount),
        },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('eco command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('give: adds credits to the target', async () => {
        const interaction = makeInteraction({ sub: 'give', amount: 200 });
        updateBalance.mockResolvedValue({ balance: 700 });

        await eco.execute(interaction);

        expect(updateBalance).toHaveBeenCalledWith('target1', 'g1', 200);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Gave') })
        );
    });

    test('take: removes credits from the target', async () => {
        const interaction = makeInteraction({ sub: 'take', amount: 100 });
        updateBalance.mockResolvedValue({ balance: 400 });

        await eco.execute(interaction);

        expect(updateBalance).toHaveBeenCalledWith('target1', 'g1', -100);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Took') })
        );
    });

    test('take: reports insufficient balance without mutating state further', async () => {
        const interaction = makeInteraction({ sub: 'take', amount: 5000 });
        updateBalance.mockResolvedValue(null);
        getWallet.mockResolvedValue({ balance: 50 });

        await eco.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('not enough to take') })
        );
    });

    test('set: overwrites the balance to an exact amount', async () => {
        const interaction = makeInteraction({ sub: 'set', amount: 1000 });

        await eco.execute(interaction);

        expect(EconomySchema.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: 'target1', guildId: 'g1' },
            expect.objectContaining({ $set: { balance: 1000 } }),
            { upsert: true }
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Set') })
        );
    });

    test('reset: zeroes out balance, streak, and all cooldowns', async () => {
        const interaction = makeInteraction({ sub: 'reset' });

        await eco.execute(interaction);

        expect(EconomySchema.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: 'target1', guildId: 'g1' },
            { $set: { balance: 0, lastDailyAt: null, lastWorkAt: null, lastRobAt: null, dailyStreak: 0 } },
            { upsert: true }
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Reset') })
        );
    });
});
