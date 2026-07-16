jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn() }));

const { getLogChannel } = require('../../utils/logger');
const messageUpdate = require('../../events/messageUpdate');

function makeMessage(overrides: Record<string, any> = {}) {
    return {
        guild: { id: 'g1' },
        author: { id: 'user1', bot: false, username: 'User', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/a.png') },
        channelId: 'chan1',
        content: 'old content',
        url: 'https://discord.com/channels/g1/chan1/msg1',
        ...overrides,
    };
}

function makeClient(): any {
    return {};
}

describe('messageUpdate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        getLogChannel.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('ignores updates outside a guild (DMs)', async () => {
        const oldMessage = makeMessage({ content: 'old' });
        const newMessage = makeMessage({ content: 'new', guild: null });
        const client = makeClient();

        await messageUpdate.execute(oldMessage, newMessage, client);

        expect(client.editSnipeCache).toBeUndefined();
    });

    test('ignores updates from bots', async () => {
        const oldMessage = makeMessage({ content: 'old' });
        const newMessage = makeMessage({ content: 'new', author: { id: 'bot1', bot: true } });
        const client = makeClient();

        await messageUpdate.execute(oldMessage, newMessage, client);

        expect(client.editSnipeCache).toBeUndefined();
    });

    test('ignores updates where the content did not actually change (e.g. embed load)', async () => {
        const oldMessage = makeMessage({ content: 'same' });
        const newMessage = makeMessage({ content: 'same' });
        const client = makeClient();

        await messageUpdate.execute(oldMessage, newMessage, client);

        expect(client.editSnipeCache).toBeUndefined();
    });

    test('caches the edit for /snipe edit', async () => {
        const oldMessage = makeMessage({ content: 'before' });
        const newMessage = makeMessage({ content: 'after' });
        const client = makeClient();

        await messageUpdate.execute(oldMessage, newMessage, client);

        expect(client.editSnipeCache.get('chan1')).toEqual(
            expect.objectContaining({ before: 'before', after: 'after' })
        );
    });

    test('does not cache when the old message had no content (uncached partial)', async () => {
        const oldMessage = makeMessage({ content: '' });
        const newMessage = makeMessage({ content: 'after' });
        const client = makeClient();

        await messageUpdate.execute(oldMessage, newMessage, client);

        expect(client.editSnipeCache.get('chan1')).toBeUndefined();
    });

    test('expires the edit-snipe cache entry after 5 minutes', async () => {
        const oldMessage = makeMessage({ content: 'before' });
        const newMessage = makeMessage({ content: 'after' });
        const client = makeClient();

        await messageUpdate.execute(oldMessage, newMessage, client);
        jest.advanceTimersByTime(5 * 60 * 1000);

        expect(client.editSnipeCache.get('chan1')).toBeUndefined();
    });

    test('logs the edit when a log channel is configured', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const oldMessage = makeMessage({ content: 'before' });
        const newMessage = makeMessage({ content: 'after' });
        const client = makeClient();

        await messageUpdate.execute(oldMessage, newMessage, client);

        expect(logChannel.send).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
