jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));
jest.mock('../../../utils/blackjack', () => ({
    buildDeck: jest.fn(),
    isBlackjack: jest.fn(),
    buildEmbed: jest.fn().mockReturnValue({ mock: 'embed' }),
    buildRow: jest.fn().mockReturnValue({ mock: 'row' }),
    disabledRow: jest.fn().mockReturnValue({ mock: 'disabledRow' }),
    buildPvpEmbed: jest.fn().mockReturnValue({ mock: 'pvpEmbed' }),
    buildPvpRow: jest.fn().mockReturnValue({ mock: 'pvpRow' }),
}));
jest.mock('../../../models/BlackjackSchema', () => ({ create: jest.fn() }));

const { getWallet, updateBalance } = require('../../../utils/economy');
const { buildDeck, isBlackjack } = require('../../../utils/blackjack');
const BlackjackGame = require('../../../models/BlackjackSchema');
const blackjack = require('../../../slashCommands/minigames/blackjack');

function makeDeck() {
    const cards = Array.from({ length: 20 }, (_, i) => ({ rank: i, suit: 'S' }));
    return { pop: () => cards.pop() };
}

function makeInteraction({ bet = 100, opponent = null } = {}) {
    return {
        options: {
            getInteger: jest.fn().mockReturnValue(bet),
            getUser: jest.fn().mockReturnValue(opponent),
        },
        user: { id: 'user1' },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({ id: 'msg1' }),
    };
}

describe('blackjack command (vs dealer)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        buildDeck.mockReturnValue(makeDeck());
    });

    test('rejects a bet exceeding the balance', async () => {
        const interaction = makeInteraction({ bet: 1000 });
        getWallet.mockResolvedValue({ balance: 50 });

        await blackjack.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("don't have enough coins") })
        );
        expect(updateBalance).not.toHaveBeenCalled();
    });

    test('deducts the bet, deals cards, and starts a normal game', async () => {
        const interaction = makeInteraction({ bet: 100 });
        getWallet.mockResolvedValueOnce({ balance: 500 }).mockResolvedValueOnce({ balance: 400 });
        isBlackjack.mockReturnValue(false);

        await blackjack.execute(interaction);

        expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', -100);
        expect(BlackjackGame.create).toHaveBeenCalledWith(
            expect.objectContaining({ messageId: 'msg1', userId: 'user1', guildId: 'g1', bet: 100 })
        );
    });

    test('pays out 3:2 on a natural blackjack (no dealer blackjack)', async () => {
        const interaction = makeInteraction({ bet: 100 });
        getWallet.mockResolvedValueOnce({ balance: 500 });
        isBlackjack.mockImplementation((hand) => hand === 'playerHandMarker');
        // First call checks player hand -> true, second checks dealer hand -> false
        let call = 0;
        isBlackjack.mockImplementation(() => { call += 1; return call === 1; });

        await blackjack.execute(interaction);

        expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', -100);
        expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', 100 + Math.floor(100 * 1.5));
        expect(BlackjackGame.create).toHaveBeenCalledWith(
            expect.objectContaining({ finished: true })
        );
    });

    test('pushes (returns bet only) when both player and dealer have blackjack', async () => {
        const interaction = makeInteraction({ bet: 100 });
        getWallet.mockResolvedValueOnce({ balance: 500 });
        isBlackjack.mockReturnValue(true);

        await blackjack.execute(interaction);

        expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', -100);
        expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', 100);
    });
});

describe('blackjack command (pvp)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        buildDeck.mockReturnValue(makeDeck());
    });

    test('rejects challenging a bot', async () => {
        const interaction = makeInteraction({ opponent: { id: 'bot1', bot: true } });

        await blackjack.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You cannot challenge a bot.' })
        );
    });

    test('rejects challenging yourself', async () => {
        const interaction = makeInteraction({ opponent: { id: 'user1', bot: false } });

        await blackjack.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You cannot challenge yourself.' })
        );
    });

    test('rejects an unaffordable challenge bet', async () => {
        const interaction = makeInteraction({ bet: 1000, opponent: { id: 'target1', bot: false } });
        getWallet.mockResolvedValue({ balance: 50 });

        await blackjack.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("don't have enough coins") })
        );
    });

    test('posts a challenge with accept/decline buttons when valid', async () => {
        const interaction = makeInteraction({ bet: 100, opponent: { id: 'target1', bot: false } });
        getWallet.mockResolvedValue({ balance: 500 });
        const response = { createMessageComponentCollector: jest.fn().mockReturnValue({ on: jest.fn() }) };
        interaction.editReply.mockResolvedValue(response);

        await blackjack.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
        );
        expect(response.createMessageComponentCollector).toHaveBeenCalled();
    });
});
