jest.mock('../../../models/PollSchema', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));
jest.mock('../../../slashCommands/fun/poll', () => ({
    buildEmbed: jest.fn().mockReturnValue({ mock: 'embed' }),
    buildButtons: jest.fn().mockReturnValue({ mock: 'row' }),
}));

const PollSchema = require('../../../models/PollSchema');
const pollVote = require('../../../handlers/components/pollVote');

function makeInteraction({ customId = 'poll_vote_1', userId = 'user1' } = {}) {
    return {
        customId,
        user: { id: userId },
        message: {
            id: 'msg1',
            embeds: [{ footer: { text: 'Poll by Host#0001 • something' } }],
            edit: jest.fn().mockResolvedValue({}),
        },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('pollVote', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('replies that the poll ended when no active poll is found', async () => {
        PollSchema.findOne.mockResolvedValue(null);
        const interaction = makeInteraction();

        await pollVote.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'This poll has already ended.' })
        );
        expect(PollSchema.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('pulls the voter from every option then adds them to the new one', async () => {
        PollSchema.findOne.mockResolvedValue({
            options: ['Red', 'Blue'],
            votes: new Map([['0', ['otherUser']]]),
        });
        PollSchema.findOneAndUpdate
            .mockResolvedValueOnce({ options: ['Red', 'Blue'], votes: new Map(), question: 'q', endsAt: null })
            .mockResolvedValueOnce({ options: ['Red', 'Blue'], votes: new Map([['1', ['user1']]]), question: 'q', endsAt: null });
        const interaction = makeInteraction({ customId: 'poll_vote_1', userId: 'user1' });

        await pollVote.execute(interaction);

        expect(PollSchema.findOneAndUpdate).toHaveBeenNthCalledWith(
            1,
            { messageId: 'msg1', ended: false },
            { $pull: { 'votes.0': 'user1', 'votes.1': 'user1' } },
            { new: true },
        );
        expect(PollSchema.findOneAndUpdate).toHaveBeenNthCalledWith(
            2,
            { messageId: 'msg1', ended: false },
            { $addToSet: { 'votes.1': 'user1' } },
            { new: true },
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You voted for Blue.' })
        );
    });

    test('toggles the vote off without re-adding when clicking the same option again', async () => {
        PollSchema.findOne.mockResolvedValue({
            options: ['Red', 'Blue'],
            votes: new Map([['0', ['user1']]]),
        });
        PollSchema.findOneAndUpdate.mockResolvedValueOnce({ options: ['Red', 'Blue'], votes: new Map(), question: 'q', endsAt: null });
        const interaction = makeInteraction({ customId: 'poll_vote_0', userId: 'user1' });

        await pollVote.execute(interaction);

        expect(PollSchema.findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Your vote has been removed.' })
        );
    });

    test('replies that the poll ended if it ends between the pull and add steps', async () => {
        PollSchema.findOne.mockResolvedValue({
            options: ['Red', 'Blue'],
            votes: new Map(),
        });
        PollSchema.findOneAndUpdate.mockResolvedValueOnce(null);
        const interaction = makeInteraction({ customId: 'poll_vote_0', userId: 'user1' });

        await pollVote.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'This poll has already ended.' })
        );
    });
});
