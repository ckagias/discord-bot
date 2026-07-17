jest.mock('../../../models/EconomySchema', () => ({
    findOne: jest.fn(),
}));
jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    updateBalance: jest.fn(),
    claimCooldown: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const EconomySchema = require('../../../models/EconomySchema');
const { getWallet, updateBalance, claimCooldown } = require('../../../utils/economy');
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
        getWallet.mockResolvedValueOnce({ lastRobAt: new Date() });

        await rob.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('laying low') })
        );
        expect(claimCooldown).not.toHaveBeenCalled();
    });

    test('rejects when the target does not have enough credits to be worth robbing', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null }).mockResolvedValueOnce({ balance: 50 });

        await rob.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("doesn't have enough credits to rob") })
        );
        expect(claimCooldown).not.toHaveBeenCalled();
    });

    test('reports laying-low when a concurrent /rob call wins the cooldown claim race', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce(null);
        EconomySchema.findOne.mockResolvedValueOnce({ lastRobAt: new Date() });

        await rob.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('laying low') })
        );
        expect(updateBalance).not.toHaveBeenCalled();
    });

    test('atomically claims the cooldown before resolving the outcome', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce({ lastRobAt: new Date(), balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0.99); // force failure branch, deterministic steal amount
        updateBalance.mockResolvedValueOnce({ balance: 900 });

        await rob.execute(interaction);

        expect(claimCooldown).toHaveBeenCalledWith('robber1', 'g1', 'lastRobAt', expect.any(Number));
        (Math.random as jest.Mock).mockRestore();
    });

    test('on success: steals from the target and credits the robber', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce({ lastRobAt: new Date(), balance: 1000 });
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
        (Math.random as jest.Mock).mockRestore();
    });

    test('on success: reports failure gracefully if the target was drained concurrently', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce({ lastRobAt: new Date(), balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0);
        updateBalance.mockResolvedValueOnce(null); // target debit failed (insufficient funds)

        await rob.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('no longer has enough credits to rob') })
        );
        expect(updateBalance).toHaveBeenCalledTimes(1);
        (Math.random as jest.Mock).mockRestore();
    });

    test('on failure: fines the robber and shows the reduced balance', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce({ lastRobAt: new Date(), balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0.99); // fail (>= 0.45); stealAmount = floor(1000 * 0.397) = 397, fine = floor(397 * 0.25) = 99
        updateBalance.mockResolvedValueOnce({ balance: 175 });

        await rob.execute(interaction);

        expect(updateBalance).toHaveBeenCalledWith('robber1', 'g1', -99);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
        (Math.random as jest.Mock).mockRestore();
    });

    test('on failure: falls back to the claimed balance if the fine deduction itself fails', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce({ lastRobAt: new Date(), balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0.99);
        updateBalance.mockResolvedValueOnce(null);

        await rob.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
        (Math.random as jest.Mock).mockRestore();
    });
});
