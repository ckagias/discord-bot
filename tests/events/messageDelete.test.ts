jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn() }));

const { getLogChannel } = require('../../utils/logger');
const messageDelete = require('../../events/messageDelete');

function makeMessage(overrides: Record<string, any> = {}) {
    return {
        guild: { id: 'g1' },
        author: { id: 'user1', bot: false, username: 'User', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/a.png') },
        channelId: 'chan1',
        content: 'deleted content',
        attachments: { size: 0, first: () => undefined },
        ...overrides,
    };
}

function makeClient(): any {
    return {};
}

describe('messageDelete', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        getLogChannel.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('ignores messages outside a guild (DMs)', async () => {
        const message = makeMessage({ guild: null });
        const client = makeClient();

        await messageDelete.execute(message, client);

        expect(client.snipeCache).toBeUndefined();
    });

    test('ignores messages authored by bots', async () => {
        const message = makeMessage({ author: { id: 'bot1', bot: true } });
        const client = makeClient();

        await messageDelete.execute(message, client);

        expect(client.snipeCache).toBeUndefined();
    });

    test('caches the deleted message for /snipe', async () => {
        const message = makeMessage();
        const client = makeClient();

        await messageDelete.execute(message, client);

        expect(client.snipeCache.get('chan1')).toEqual(
            expect.objectContaining({ content: 'deleted content' })
        );
    });

    test('does not cache a message with no content and no attachments', async () => {
        const message = makeMessage({ content: '', attachments: { size: 0, first: () => undefined } });
        const client = makeClient();

        await messageDelete.execute(message, client);

        expect(client.snipeCache.get('chan1')).toBeUndefined();
    });

    test('expires the snipe cache entry after 5 minutes', async () => {
        const message = makeMessage();
        const client = makeClient();

        await messageDelete.execute(message, client);
        expect(client.snipeCache.get('chan1')).toBeDefined();

        jest.advanceTimersByTime(5 * 60 * 1000);
        expect(client.snipeCache.get('chan1')).toBeUndefined();
    });

    test('does not expire a newer cache entry that replaced the original', async () => {
        const client = makeClient();
        await messageDelete.execute(makeMessage(), client);
        const firstTimeout = 5 * 60 * 1000 - 1000;
        jest.advanceTimersByTime(firstTimeout);

        // A second delete in the same channel overwrites the cache entry before the first timer fires.
        await messageDelete.execute(makeMessage({ content: 'second' }), client);
        jest.advanceTimersByTime(1000);

        expect(client.snipeCache.get('chan1')).toEqual(
            expect.objectContaining({ content: 'second' })
        );
    });

    test('logs the deletion when a log channel is configured', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const message = makeMessage();
        const client = makeClient();

        await messageDelete.execute(message, client);

        expect(logChannel.send).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('handles a partial/uncached message with no author gracefully', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const message = makeMessage({ author: null });
        const client = makeClient();

        await expect(messageDelete.execute(message, client)).resolves.not.toThrow();
        expect(logChannel.send).toHaveBeenCalled();
    });
});
