jest.mock('../../../utils/economy', () => ({
    updateBalance: jest.fn(),
    getWallet: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const { updateBalance, getWallet } = require('../../../utils/economy');
const transfer = require('../../../slashCommands/economy/transfer');

function makeInteraction({ targetId = 'target1', targetBot = false, amount = 100 } = {}) {
    return {
        options: {
            getUser: jest.fn().mockReturnValue({ id: targetId, bot: targetBot, toString: () => `<@${targetId}>` }),
            getInteger: jest.fn().mockReturnValue(amount),
        },
        user: { id: 'sender1' },
        guild: { id: 'g1' },
        reply: jest.fn().mockResolvedValue({}),
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('transfer command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects transferring to yourself', async () => {
        const interaction = makeInteraction({ targetId: 'sender1' });

        await transfer.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You cannot transfer credits to yourself.' })
        );
        expect(updateBalance).not.toHaveBeenCalled();
    });

    test('rejects transferring to a bot', async () => {
        const interaction = makeInteraction({ targetBot: true });

        await transfer.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You cannot transfer credits to a bot.' })
        );
    });

    test('rejects when the sender has insufficient funds', async () => {
        const interaction = makeInteraction({ amount: 500 });
        updateBalance.mockResolvedValueOnce(null);
        getWallet.mockResolvedValueOnce({ balance: 50 });

        await transfer.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("don't have enough credits") })
        );
        expect(updateBalance).toHaveBeenCalledTimes(1);
    });

    test('completes the transfer when both debit and credit succeed', async () => {
        const interaction = makeInteraction({ amount: 100 });
        updateBalance
            .mockResolvedValueOnce({ balance: 400 })  // sender debited
            .mockResolvedValueOnce({ balance: 600 }); // receiver credited

        await transfer.execute(interaction);

        expect(updateBalance).toHaveBeenNthCalledWith(1, 'sender1', 'g1', -100);
        expect(updateBalance).toHaveBeenNthCalledWith(2, 'target1', 'g1', 100);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reverses the sender debit if crediting the receiver fails', async () => {
        const interaction = makeInteraction({ amount: 100 });
        updateBalance
            .mockResolvedValueOnce({ balance: 400 }) // sender debited
            .mockResolvedValueOnce(null)              // receiver credit failed
            .mockResolvedValueOnce({ balance: 500 }); // reversal

        await transfer.execute(interaction);

        expect(updateBalance).toHaveBeenNthCalledWith(3, 'sender1', 'g1', 100);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('coins have been returned') })
        );
    });
});
