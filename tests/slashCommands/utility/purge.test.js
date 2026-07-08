const purge = require('../../../slashCommands/utility/purge');

function makeCollection(items) {
    const map = new Map(items.map((item, i) => [i, item]));
    map.filter = (fn) => makeCollection([...map.values()].filter(fn));
    return map;
}

function makeMessage(overrides = {}) {
    return {
        createdTimestamp: Date.now(),
        author: { id: 'user1', bot: false },
        content: 'hello world',
        attachments: { size: 0 },
        embeds: [],
        ...overrides,
    };
}

function makeInteraction({ amount = 10, user = null, bots = null, contains = null, attachments = null } = {}) {
    return {
        options: {
            getInteger: jest.fn().mockReturnValue(amount),
            getUser: jest.fn().mockReturnValue(user),
            getBoolean: jest.fn((opt) => (opt === 'bots' ? bots : attachments)),
            getString: jest.fn().mockReturnValue(contains),
        },
        channel: {
            bulkDelete: jest.fn().mockResolvedValue({ size: 5 }),
            messages: { fetch: jest.fn().mockResolvedValue(makeCollection([makeMessage()])) },
        },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('purge command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('uses the fast bulkDelete path when no filters are set', async () => {
        const interaction = makeInteraction({ amount: 20 });

        await purge.execute(interaction);

        expect(interaction.channel.bulkDelete).toHaveBeenCalledWith(20, true);
        expect(interaction.channel.messages.fetch).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('deleted **5** messages') })
        );
    });

    test('filters by user and reports when nothing matches', async () => {
        const interaction = makeInteraction({ amount: 10, user: { id: 'other1' } });
        interaction.channel.messages.fetch.mockResolvedValue(makeCollection([makeMessage({ author: { id: 'user1', bot: false } })]));

        await purge.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("matched those filters") })
        );
        expect(interaction.channel.bulkDelete).not.toHaveBeenCalled();
    });

    test('filters by user and deletes matches', async () => {
        const interaction = makeInteraction({ amount: 10, user: { id: 'user1' } });
        interaction.channel.messages.fetch.mockResolvedValue(makeCollection([
            makeMessage({ author: { id: 'user1', bot: false } }),
            makeMessage({ author: { id: 'other1', bot: false } }),
        ]));

        await purge.execute(interaction);

        expect(interaction.channel.bulkDelete).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('matching your filters') })
        );
    });

    test('filters out messages older than 14 days even if they match other filters', async () => {
        const interaction = makeInteraction({ amount: 10, bots: true });
        interaction.channel.messages.fetch.mockResolvedValue(makeCollection([
            makeMessage({ author: { id: 'bot1', bot: true }, createdTimestamp: Date.now() - 20 * 86400000 }),
        ]));

        await purge.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("matched those filters") })
        );
    });

    test('filters by content substring case-insensitively', async () => {
        const interaction = makeInteraction({ amount: 10, contains: 'HELLO' });
        interaction.channel.messages.fetch.mockResolvedValue(makeCollection([makeMessage({ content: 'hello world' })]));

        await purge.execute(interaction);

        expect(interaction.channel.bulkDelete).toHaveBeenCalled();
    });

    test('filters by attachments/embeds presence', async () => {
        const interaction = makeInteraction({ amount: 10, attachments: true });
        interaction.channel.messages.fetch.mockResolvedValue(makeCollection([
            makeMessage({ attachments: { size: 1 }, embeds: [] }),
            makeMessage({ attachments: { size: 0 }, embeds: [] }),
        ]));

        await purge.execute(interaction);

        expect(interaction.channel.bulkDelete).toHaveBeenCalled();
    });

    test('reports a permission/age error when bulkDelete throws', async () => {
        const interaction = makeInteraction({ amount: 10 });
        interaction.channel.bulkDelete.mockRejectedValue(new Error('too old'));

        await expect(purge.execute(interaction)).resolves.not.toThrow();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('cannot delete messages older than 14 days') })
        );
    });
});
