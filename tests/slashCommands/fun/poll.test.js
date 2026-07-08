jest.mock('../../../models/PollSchema', () => ({
    create: jest.fn(),
    findById: jest.fn(),
}));

const PollSchema = require('../../../models/PollSchema');
const poll = require('../../../slashCommands/fun/poll');

function makeInteraction({ question = 'Best color?', options = ['Red', 'Blue'], duration = null } = {}) {
    const opts = { option1: options[0], option2: options[1], option3: options[2] ?? null, option4: options[3] ?? null };
    return {
        options: {
            getString: jest.fn((name) => (name === 'question' ? question : name === 'duration' ? duration : opts[name] ?? null)),
        },
        user: { id: 'host1', tag: 'Host#0001' },
        guildId: 'g1',
        channelId: 'chan1',
        reply: jest.fn().mockResolvedValue({}),
        fetchReply: jest.fn().mockResolvedValue({ id: 'msg1' }),
    };
}

describe('poll command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('rejects an invalid duration format', async () => {
        const interaction = makeInteraction({ duration: 'bogus' });

        await poll.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Invalid duration') })
        );
        expect(PollSchema.create).not.toHaveBeenCalled();
    });

    test('rejects a duration exceeding 24 hours', async () => {
        const interaction = makeInteraction({ duration: '25h' });

        await poll.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('cannot exceed 24 hours') })
        );
    });

    test('creates a poll with only the required 2 options when optional ones are blank', async () => {
        const interaction = makeInteraction({ options: ['Red', 'Blue'] });
        PollSchema.create.mockResolvedValue({ _id: 'poll1' });

        await poll.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
        );
        expect(PollSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ question: 'Best color?', options: ['Red', 'Blue'], hostId: 'host1' })
        );
    });

    test('creates a poll with all 4 options when provided', async () => {
        const interaction = makeInteraction({ options: ['A', 'B', 'C', 'D'] });
        PollSchema.create.mockResolvedValue({ _id: 'poll1' });

        await poll.execute(interaction);

        expect(PollSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ options: ['A', 'B', 'C', 'D'] })
        );
    });

    test('schedules an auto-close when a valid duration is given', async () => {
        const interaction = makeInteraction({ duration: '10m' });
        PollSchema.create.mockResolvedValue({ _id: 'poll1' });
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        await poll.execute(interaction);

        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
    });

    test('does not schedule an auto-close when no duration is given', async () => {
        const interaction = makeInteraction({ duration: null });
        PollSchema.create.mockResolvedValue({ _id: 'poll1' });
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        await poll.execute(interaction);

        expect(setTimeoutSpy).not.toHaveBeenCalled();
    });
});

describe('poll.closePoll', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    function makeClient(message) {
        return {
            guilds: { cache: { get: jest.fn().mockReturnValue({ channels: { cache: { get: jest.fn().mockReturnValue({ messages: { fetch: jest.fn().mockResolvedValue(message) } }) } } }) } },
        };
    }

    test('does nothing if the poll no longer exists', async () => {
        PollSchema.findById.mockResolvedValue(null);

        await expect(poll.closePoll(makeClient(null), 'poll1')).resolves.not.toThrow();
    });

    test('does nothing if the poll has already ended', async () => {
        PollSchema.findById.mockResolvedValue({ ended: true, save: jest.fn() });

        await poll.closePoll(makeClient(null), 'poll1');

        expect(PollSchema.findById).toHaveBeenCalled();
    });

    test('marks the poll ended, saves it, and edits the message with disabled buttons', async () => {
        const pollDoc = {
            ended: false, save: jest.fn().mockResolvedValue({}),
            guildId: 'g1', channelId: 'chan1', messageId: 'msg1',
            question: 'Best color?', options: ['Red', 'Blue'], votes: new Map(),
        };
        PollSchema.findById.mockResolvedValue(pollDoc);
        const message = { embeds: [{ footer: { text: 'Poll by Host#0001 • 0 votes' } }], edit: jest.fn().mockResolvedValue({}) };
        const client = makeClient(message);

        await poll.closePoll(client, 'poll1');

        expect(pollDoc.ended).toBe(true);
        expect(pollDoc.save).toHaveBeenCalled();
        expect(message.edit).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
        );
    });

    test('does nothing further if the poll message can no longer be fetched', async () => {
        const pollDoc = { ended: false, save: jest.fn().mockResolvedValue({}), guildId: 'g1', channelId: 'chan1', messageId: 'msg1' };
        PollSchema.findById.mockResolvedValue(pollDoc);
        const client = makeClient(null);

        await expect(poll.closePoll(client, 'poll1')).resolves.not.toThrow();
    });
});
