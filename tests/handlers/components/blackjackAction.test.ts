jest.mock('../../../models/BlackjackSchema', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
}));
jest.mock('../../../utils/economy', () => ({
    updateBalance: jest.fn(),
    getWallet: jest.fn(),
    formatBalance: (n: number) => `${n}`,
}));

const BlackjackGame = require('../../../models/BlackjackSchema');
const { getWallet } = require('../../../utils/economy');
const components = require('../../../handlers/components/blackjackAction');

function handler(id: string) {
    return components.find((c: any) => c.id === id).execute;
}

function makeGame(overrides: any = {}) {
    return {
        userId: 'user1',
        opponentId: null,
        guildId: 'g1',
        bet: 100,
        deck: ['2♠', '3♠'],
        playerHand: ['5♠', '6♠'],
        dealerHand: ['9♠', '9♥'],
        finished: false,
        opponentDone: false,
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue({}),
        ...overrides,
    };
}

function makeInteraction() {
    return {
        message: { id: 'msg1' },
        user: { id: 'user1' },
        client: { users: { fetch: jest.fn().mockResolvedValue({ username: 'User' }) } },
        reply: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
    };
}

describe('blackjackAction concurrency lock', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getWallet.mockResolvedValue({ balance: 1000 });
        BlackjackGame.updateOne.mockResolvedValue({});
    });

    test('rejects the action when the game is already being processed (fast double-click)', async () => {
        const game = makeGame();
        BlackjackGame.findOne.mockResolvedValue(game);
        BlackjackGame.findOneAndUpdate.mockResolvedValue(null);
        const interaction = makeInteraction();

        await handler('bj_hit')(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('still being processed') })
        );
    });

    test('claims the lock atomically before mutating the hand', async () => {
        const game = makeGame();
        const claimed = makeGame({ deck: ['4♠'], playerHand: ['5♠', '6♠'] });
        BlackjackGame.findOne.mockResolvedValue(game);
        BlackjackGame.findOneAndUpdate.mockResolvedValue(claimed);
        const interaction = makeInteraction();

        await handler('bj_hit')(interaction);

        expect(BlackjackGame.findOneAndUpdate).toHaveBeenCalledWith(
            { messageId: 'msg1', finished: false, processing: { $ne: true } },
            { $set: { processing: true } },
            { new: true },
        );
    });

    test('releases the lock after the action completes', async () => {
        const game = makeGame();
        const claimed = makeGame({ deck: ['4♠'], playerHand: ['5♠', '6♠'] });
        BlackjackGame.findOne.mockResolvedValue(game);
        BlackjackGame.findOneAndUpdate.mockResolvedValue(claimed);
        const interaction = makeInteraction();

        await handler('bj_hit')(interaction);

        expect(BlackjackGame.updateOne).toHaveBeenCalledWith({ messageId: 'msg1' }, { $set: { processing: false } });
    });

    test('releases the lock even when the action errors partway through', async () => {
        const game = makeGame();
        const claimed = makeGame({ deck: ['4♠'], playerHand: ['5♠', '6♠'] });
        BlackjackGame.findOne.mockResolvedValue(game);
        BlackjackGame.findOneAndUpdate.mockResolvedValue(claimed);
        getWallet.mockRejectedValue(new Error('db down'));
        const interaction = makeInteraction();

        await expect(handler('bj_double')(interaction)).rejects.toThrow('db down');

        expect(BlackjackGame.updateOne).toHaveBeenCalledWith({ messageId: 'msg1' }, { $set: { processing: false } });
    });

    test('does not attempt to claim the lock when the interaction is not the game owner', async () => {
        const game = makeGame({ userId: 'someoneElse' });
        BlackjackGame.findOne.mockResolvedValue(game);
        const interaction = makeInteraction();

        await handler('bj_hit')(interaction);

        expect(BlackjackGame.findOneAndUpdate).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('not your game') })
        );
    });
});
