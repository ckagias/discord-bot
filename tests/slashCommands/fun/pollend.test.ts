jest.mock('../../../models/PollSchema', () => ({ findOne: jest.fn() }));
jest.mock('../../../slashCommands/fun/poll', () => ({ closePoll: jest.fn() }));

const PollSchema = require('../../../models/PollSchema');
const { closePoll } = require('../../../slashCommands/fun/poll');
const pollend = require('../../../slashCommands/fun/pollend');

function makeInteraction({ messageId = 'msg1', userId = 'host1', isAdmin = false } = {}) {
    return {
        options: { getString: jest.fn().mockReturnValue(messageId) },
        guildId: 'g1',
        user: { id: userId },
        member: { permissions: { has: jest.fn().mockReturnValue(isAdmin) } },
        client: {},
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('pollend command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('reports no active poll found', async () => {
        const interaction = makeInteraction();
        PollSchema.findOne.mockResolvedValue(null);

        await pollend.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'No active poll found with that message ID.' })
        );
        expect(closePoll).not.toHaveBeenCalled();
    });

    test('rejects a non-host, non-admin user', async () => {
        const interaction = makeInteraction({ userId: 'someoneElse', isAdmin: false });
        PollSchema.findOne.mockResolvedValue({ hostId: 'host1', _id: 'poll1' });

        await pollend.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('poll creator or a server admin') })
        );
        expect(closePoll).not.toHaveBeenCalled();
    });

    test('allows the host to end their own poll', async () => {
        const interaction = makeInteraction({ userId: 'host1', isAdmin: false });
        PollSchema.findOne.mockResolvedValue({ hostId: 'host1', _id: 'poll1' });

        await pollend.execute(interaction);

        expect(closePoll).toHaveBeenCalledWith(interaction.client, 'poll1');
    });

    test('allows a server admin to end a poll they do not own', async () => {
        const interaction = makeInteraction({ userId: 'admin1', isAdmin: true });
        PollSchema.findOne.mockResolvedValue({ hostId: 'host1', _id: 'poll1' });

        await pollend.execute(interaction);

        expect(closePoll).toHaveBeenCalledWith(interaction.client, 'poll1');
    });
});
