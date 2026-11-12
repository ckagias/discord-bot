jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));
jest.mock('../../../utils/heist', () => ({ launchHeist: jest.fn() }));
jest.mock('../../../models/HeistSchema', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

const { getWallet, updateBalance } = require('../../../utils/economy');
const { launchHeist } = require('../../../utils/heist');
const HeistSchema = require('../../../models/HeistSchema');
const components = require('../../../handlers/components/heist');

const join = components.find((c) => c.id === 'heist_join');
const cancel = components.find((c) => c.id === 'heist_cancel');
const begin = components.find((c) => c.id === 'heist_begin');

const lean = (doc) => ({ lean: jest.fn().mockResolvedValue(doc) });

function makeHeist(overrides = {}) {
    return {
        _id: 'h1', messageId: 'msg1', leaderId: 'leader', entryFee: 50, finished: false,
        members: [{ userId: 'leader', username: 'Leader' }, { userId: 'u2', username: 'Two' }],
        ...overrides,
    };
}

function makeInteraction(userId = 'leader') {
    return {
        user: { id: userId, username: 'User' },
        guild: { id: 'g1' },
        message: { id: 'msg1', edit: jest.fn().mockResolvedValue({}) },
        reply: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    updateBalance.mockResolvedValue({ balance: 100 });
});

describe('heist_join', () => {
    test('replies that the heist is over when none is active', async () => {
        HeistSchema.findOne.mockReturnValue(lean(null));
        const interaction = makeInteraction('u3');

        await join.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: 'This heist is no longer active.' }));
        expect(updateBalance).not.toHaveBeenCalled();
    });

    test('rejects someone already in the crew before touching their balance', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        const interaction = makeInteraction('u2');

        await join.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: 'You have already joined this heist.' }));
        expect(updateBalance).not.toHaveBeenCalled();
    });

    test('rejects a member who cannot afford the entry fee', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        getWallet.mockResolvedValue({ balance: 10 });
        const interaction = makeInteraction('u3');

        await join.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("don't have enough coins") }));
        expect(HeistSchema.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('takes the fee before adding the member to the crew', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        getWallet.mockResolvedValue({ balance: 500 });
        HeistSchema.findOneAndUpdate.mockResolvedValue(makeHeist({ members: [{ userId: 'u3', username: 'User' }] }));
        const interaction = makeInteraction('u3');

        await join.execute(interaction);

        expect(updateBalance).toHaveBeenCalledWith('u3', 'g1', -50);
        expect(updateBalance.mock.invocationCallOrder[0]).toBeLessThan(HeistSchema.findOneAndUpdate.mock.invocationCallOrder[0]);
        expect(interaction.update).toHaveBeenCalled();
    });

    test('does not add the member when the fee cannot be taken', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        getWallet.mockResolvedValue({ balance: 500 }); // looked affordable, but the balance was spent before the debit
        updateBalance.mockResolvedValue(null);
        const interaction = makeInteraction('u3');

        await join.execute(interaction);

        expect(HeistSchema.findOneAndUpdate).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: 'You no longer have enough coins to join.' }));
    });

    test('gives the fee back when the member could not be added', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        getWallet.mockResolvedValue({ balance: 500 });
        HeistSchema.findOneAndUpdate.mockResolvedValue(null); // joined by a concurrent click, or the heist just ended
        const interaction = makeInteraction('u3');

        await join.execute(interaction);

        expect(updateBalance).toHaveBeenNthCalledWith(1, 'u3', 'g1', -50);
        expect(updateBalance).toHaveBeenNthCalledWith(2, 'u3', 'g1', 50);
        expect(interaction.update).not.toHaveBeenCalled();
    });
});

describe('heist_cancel', () => {
    test('replies that the heist is over when none is active', async () => {
        HeistSchema.findOne.mockReturnValue(lean(null));
        const interaction = makeInteraction();

        await cancel.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: 'This heist is no longer active.' }));
        expect(HeistSchema.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('only lets the organizer cancel', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        const interaction = makeInteraction('u2');

        await cancel.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: 'Only the heist organizer can cancel it.' }));
        expect(HeistSchema.findOneAndUpdate).not.toHaveBeenCalled();
        expect(updateBalance).not.toHaveBeenCalled();
    });

    test('claims the heist atomically, then refunds every member from the claimed document', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        HeistSchema.findOneAndUpdate.mockResolvedValue(makeHeist({
            finished: true,
            members: [{ userId: 'leader' }, { userId: 'u2' }, { userId: 'u3' }],
        }));
        const interaction = makeInteraction();

        await cancel.execute(interaction);

        expect(HeistSchema.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'h1', finished: false },
            { $set: { finished: true } },
            { returnDocument: 'after' }
        );
        expect(updateBalance).toHaveBeenCalledTimes(3);
        for (const id of ['leader', 'u2', 'u3']) expect(updateBalance).toHaveBeenCalledWith(id, 'g1', 50);
        expect(interaction.update).toHaveBeenCalled();
    });

    test('refunds nothing when the heist was already claimed by a second click or the launch', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        HeistSchema.findOneAndUpdate.mockResolvedValue(null);
        const interaction = makeInteraction();

        await cancel.execute(interaction);

        expect(updateBalance).not.toHaveBeenCalled();
        expect(interaction.update).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: 'This heist is no longer active.' }));
    });
});

describe('heist_begin', () => {
    test('only lets the organizer begin', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        const interaction = makeInteraction('u2');

        await begin.execute(interaction);

        expect(launchHeist).not.toHaveBeenCalled();
    });

    test('launches the heist', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        launchHeist.mockResolvedValue(undefined);
        const interaction = makeInteraction();

        await begin.execute(interaction);

        expect(launchHeist).toHaveBeenCalledWith(interaction.message, interaction.guild);
        expect(updateBalance).not.toHaveBeenCalled();
    });

    test('refunds everyone when the launch failed before it claimed the heist', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        launchHeist.mockRejectedValue(new Error('db down'));
        HeistSchema.findOneAndUpdate.mockResolvedValue(makeHeist({ finished: true }));
        const interaction = makeInteraction();

        await begin.execute(interaction);

        expect(HeistSchema.findOneAndUpdate).toHaveBeenCalledWith(
            { messageId: 'msg1', finished: false },
            { $set: { finished: true } },
            { returnDocument: 'after' }
        );
        expect(updateBalance).toHaveBeenCalledTimes(2);
        expect(updateBalance).toHaveBeenCalledWith('leader', 'g1', 50);
        expect(updateBalance).toHaveBeenCalledWith('u2', 'g1', 50);
        expect(interaction.message.edit).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('refunded') }));
    });

    test('does not refund when the launch had already claimed the heist and then failed', async () => {
        HeistSchema.findOne.mockReturnValue(lean(makeHeist()));
        launchHeist.mockRejectedValue(new Error('message.edit failed after the payouts'));
        HeistSchema.findOneAndUpdate.mockResolvedValue(null); // already finished: the outcome was applied
        const interaction = makeInteraction();

        await begin.execute(interaction);

        expect(updateBalance).not.toHaveBeenCalled();
        expect(interaction.message.edit).not.toHaveBeenCalled();
    });
});
