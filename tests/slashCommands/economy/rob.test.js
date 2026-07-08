jest.mock('../../../models/EconomySchema', () => ({
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
}));
jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const EconomySchema = require('../../../models/EconomySchema');
const { getWallet, updateBalance } = require('../../../utils/economy');
const rob = require('../../../slashCommands/economy/rob');

function makeInteraction({ targetId = 'target1', targetBot = false, username = 'Target' } = {}) {
    return {
        options: { getUser: jest.fn().mockReturnValue({ id: targetId, bot: targetBot, username }) },
        user: { id: 'robber1' },
        guild: { id: 'g1' },
        reply: jest.fn().mockResolvedValue({}),
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('rob command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        EconomySchema.updateOne.mockResolvedValue({});
    });

    test('rejects robbing yourself', async () => {
        const interaction = makeInteraction({ targetId: 'robber1' });

        await rob.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You cannot rob yourself.' })
        );
        expect(interaction.deferReply).not.toHaveBeenCalled();
    });

    test('rejects robbing a bot', async () => {
        const interaction = makeInteraction({ targetBot: true });

        await rob.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You cannot rob a bot.' })
        );
    });

    test('blocks the attempt and reports time remaining when still on cooldown', async () => {
        const interaction = makeInteraction();
        EconomySchema.findOneAndUpdate.mockResolvedValueOnce({ lastRobAt: new Date() });

        await rob.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('laying low') })
        );
        expect(getWallet).not.toHaveBeenCalled();
    });

    test('rejects when the target does not have enough credits to be worth robbing', async () => {
        const interaction = makeInteraction();
        EconomySchema.findOneAndUpdate.mockResolvedValueOnce({ lastRobAt: null });
        getWallet.mockResolvedValueOnce({ balance: 50 });

        await rob.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("doesn't have enough credits to rob") })
        );
        expect(EconomySchema.updateOne).not.toHaveBeenCalled();
    });

    test('stamps the cooldown before resolving the outcome', async () => {
        const interaction = makeInteraction();
        EconomySchema.findOneAndUpdate.mockResolvedValueOnce({ lastRobAt: null });
        getWallet.mockResolvedValueOnce({ balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0.99); // force failure branch, deterministic steal amount
        updateBalance.mockResolvedValueOnce({ balance: 900 });

        await rob.execute(interaction);

        expect(EconomySchema.updateOne).toHaveBeenCalledWith(
            { userId: 'robber1', guildId: 'g1' },
            { $set: { lastRobAt: expect.any(Date) } }
        );
        Math.random.mockRestore();
    });

    test('on success: steals from the target and credits the robber', async () => {
        const interaction = makeInteraction();
        EconomySchema.findOneAndUpdate.mockResolvedValueOnce({ lastRobAt: null });
        getWallet.mockResolvedValueOnce({ balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0); // success (< 0.45), min steal (10%)
        updateBalance
            .mockResolvedValueOnce({ balance: 900 })  // target debited
            .mockResolvedValueOnce({ balance: 1100 }); // robber credited

        await rob.execute(interaction);

        expect(updateBalance).toHaveBeenNthCalledWith(1, 'target1', 'g1', -100);
        expect(updateBalance).toHaveBeenNthCalledWith(2, 'robber1', 'g1', 100);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
        Math.random.mockRestore();
    });

    test('on success: reports failure gracefully if the target was drained concurrently', async () => {
        const interaction = makeInteraction();
        EconomySchema.findOneAndUpdate.mockResolvedValueOnce({ lastRobAt: null });
        getWallet.mockResolvedValueOnce({ balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0);
        updateBalance.mockResolvedValueOnce(null); // target debit failed (insufficient funds)

        await rob.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('no longer has enough credits to rob') })
        );
        expect(updateBalance).toHaveBeenCalledTimes(1);
        Math.random.mockRestore();
    });

    test('on failure: fines the robber and shows the reduced balance', async () => {
        const interaction = makeInteraction();
        EconomySchema.findOneAndUpdate.mockResolvedValueOnce({ lastRobAt: null, balance: 200 });
        getWallet.mockResolvedValueOnce({ balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0.99); // fail (>= 0.45); stealAmount = floor(1000 * 0.397) = 397, fine = floor(397 * 0.25) = 99
        updateBalance.mockResolvedValueOnce({ balance: 175 });

        await rob.execute(interaction);

        expect(updateBalance).toHaveBeenCalledWith('robber1', 'g1', -99);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
        Math.random.mockRestore();
    });
});
