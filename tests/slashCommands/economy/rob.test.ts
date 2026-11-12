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

describe('rob constants', () => {
    test('pin the current odds and fine so a rebalance has to change them on purpose', () => {
        expect(rob.ROB_SUCCESS_CHANCE).toBe(0.35);
        expect(rob.ROB_FINE_RATE).toBe(0.60);
        expect(rob.ROB_MIN_BALANCE).toBe(100);
        expect(rob.ROB_COOLDOWN_MS).toBe(3_600_000);
    });

    // Steal is 10-40% of the target's balance (25% on average); a failed rob costs 25% of that steal.
    test('expected value of a rob is not positive for the robber', () => {
        const avgSteal = 0.25;
        const ev = rob.ROB_SUCCESS_CHANCE * avgSteal - (1 - rob.ROB_SUCCESS_CHANCE) * avgSteal * rob.ROB_FINE_RATE;
        expect(ev).toBeLessThanOrEqual(0);
    });
});

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

    test('rejects a robber who cannot cover the worst-case fine, without using the cooldown', async () => {
        const interaction = makeInteraction();
        // Target holds 1000, so a steal is at most 399 and the fine at most 239.
        getWallet.mockResolvedValueOnce({ lastRobAt: null, balance: 0 }).mockResolvedValueOnce({ balance: 1000 });

        await rob.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('You need at least **240** credits to cover the fine') })
        );
        expect(claimCooldown).not.toHaveBeenCalled();
        expect(updateBalance).not.toHaveBeenCalled();
    });

    test('lets a robber who can just cover the worst-case fine attempt the rob', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null, balance: 240 }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce({ lastRobAt: new Date(), balance: 240 });
        jest.spyOn(Math, 'random').mockReturnValue(0.99);
        updateBalance.mockResolvedValueOnce({ balance: 2 });

        await rob.execute(interaction);

        expect(claimCooldown).toHaveBeenCalled();
        expect(updateBalance).toHaveBeenCalledWith('robber1', 'g1', -238);
        (Math.random as jest.Mock).mockRestore();
    });

    test('reports laying-low when a concurrent /rob call wins the cooldown claim race', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null, balance: 1000 }).mockResolvedValueOnce({ balance: 1000 });
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
        getWallet.mockResolvedValueOnce({ lastRobAt: null, balance: 1000 }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce({ lastRobAt: new Date(), balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0.99); // force failure branch, deterministic steal amount
        updateBalance.mockResolvedValueOnce({ balance: 900 });

        await rob.execute(interaction);

        expect(claimCooldown).toHaveBeenCalledWith('robber1', 'g1', 'lastRobAt', expect.any(Number));
        (Math.random as jest.Mock).mockRestore();
    });

    test('on success: steals from the target, credits the robber and hands the held fine back', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null, balance: 1000 }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce({ lastRobAt: new Date(), balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0); // success (< 0.35), min steal (10%): steal 100, fine 60
        updateBalance
            .mockResolvedValueOnce({ balance: 940 })   // fine held
            .mockResolvedValueOnce({ balance: 900 })   // target debited
            .mockResolvedValueOnce({ balance: 1100 }); // robber credited

        await rob.execute(interaction);

        expect(updateBalance).toHaveBeenNthCalledWith(1, 'robber1', 'g1', -60);
        expect(updateBalance).toHaveBeenNthCalledWith(2, 'target1', 'g1', -100);
        expect(updateBalance).toHaveBeenNthCalledWith(3, 'robber1', 'g1', 160);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
        (Math.random as jest.Mock).mockRestore();
    });

    test('on success: gives the held fine back if the target was drained concurrently', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null, balance: 1000 }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce({ lastRobAt: new Date(), balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0);
        updateBalance
            .mockResolvedValueOnce({ balance: 940 }) // fine held
            .mockResolvedValueOnce(null);            // target debit failed (insufficient funds)

        await rob.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('no longer has enough credits to rob') })
        );
        expect(updateBalance).toHaveBeenCalledTimes(3);
        expect(updateBalance).toHaveBeenNthCalledWith(3, 'robber1', 'g1', 60);
        (Math.random as jest.Mock).mockRestore();
    });

    test('on failure: fines the robber and shows the reduced balance', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null, balance: 1000 }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce({ lastRobAt: new Date(), balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0.99); // fail (>= 0.35); stealAmount = floor(1000 * 0.397) = 397, fine = floor(397 * 0.6) = 238
        updateBalance.mockResolvedValueOnce({ balance: 762 });

        await rob.execute(interaction);

        expect(updateBalance).toHaveBeenCalledTimes(1);
        expect(updateBalance).toHaveBeenCalledWith('robber1', 'g1', -238);
        const { embeds } = interaction.editReply.mock.calls[0][0];
        const fields = embeds[0].toJSON().fields;
        expect(fields).toEqual([
            expect.objectContaining({ name: 'Fine', value: '💸 **-238** credits' }),
            expect.objectContaining({ name: 'Your Balance', value: '💳 **762** credits' }),
        ]);
        (Math.random as jest.Mock).mockRestore();
    });

    test('does not resolve the rob or report a fine when the robber can no longer pay it', async () => {
        const interaction = makeInteraction();
        getWallet.mockResolvedValueOnce({ lastRobAt: null, balance: 1000 }).mockResolvedValueOnce({ balance: 1000 });
        claimCooldown.mockResolvedValueOnce({ lastRobAt: new Date(), balance: 1000 });
        jest.spyOn(Math, 'random').mockReturnValue(0); // would be a success
        updateBalance.mockResolvedValueOnce(null); // balance was spent after the pre-check

        await rob.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You no longer have enough credits to cover the fine.' })
        );
        expect(updateBalance).toHaveBeenCalledTimes(1);
        (Math.random as jest.Mock).mockRestore();
    });
});
