jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));
jest.mock('../../../models/HeistSchema', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));
jest.mock('../../../utils/heist', () => ({ launchHeist: jest.fn() }));

const { getWallet, updateBalance } = require('../../../utils/economy');
const HeistSchema = require('../../../models/HeistSchema');
const heist = require('../../../slashCommands/minigames/heist');

function makeInteraction({ entryFee = 50 } = {}) {
    return {
        options: { getInteger: jest.fn().mockReturnValue(entryFee) },
        user: { id: 'user1', username: 'Leader' },
        guild: { id: 'g1' },
        channel: { id: 'chan1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({ id: 'msg1' }),
    };
}

describe('heist command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('rejects when a heist is already active in the guild', async () => {
        const interaction = makeInteraction();
        HeistSchema.findOne.mockResolvedValue({ finished: false });

        await heist.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('already an active heist') })
        );
        expect(updateBalance).not.toHaveBeenCalled();
    });

    test('rejects when the leader cannot afford the entry fee', async () => {
        const interaction = makeInteraction({ entryFee: 100 });
        HeistSchema.findOne.mockResolvedValue(null);
        getWallet.mockResolvedValue({ balance: 10 });

        await heist.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("don't have enough coins") })
        );
    });

    test('deducts the leader fee, creates the heist, and posts the lobby', async () => {
        const interaction = makeInteraction({ entryFee: 50 });
        HeistSchema.findOne.mockResolvedValue(null);
        getWallet.mockResolvedValue({ balance: 500 });
        const heistDoc = { messageId: 'pending', members: [{ userId: 'user1', username: 'Leader' }], entryFee: 50, save: jest.fn().mockResolvedValue({}) };
        HeistSchema.create.mockResolvedValue(heistDoc);

        await heist.execute(interaction);

        expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', -50);
        expect(HeistSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: 'g1', leaderId: 'user1', entryFee: 50 })
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
        );
        expect(heistDoc.messageId).toBe('msg1');
        expect(heistDoc.save).toHaveBeenCalled();
    });
});
