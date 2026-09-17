jest.mock('../../utils/guildConfig', () => ({ getGuildConfig: jest.fn() }));

const { getGuildConfig } = require('../../utils/guildConfig');
const { getLogChannel } = require('../../utils/logger');

function makeGuild(channels: Record<string, any>) {
    return { id: 'g1', channels: { cache: new Map(Object.entries(channels)) } };
}

describe('getLogChannel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns null when guild has no config', async () => {
        getGuildConfig.mockResolvedValue(null);

        const result = await getLogChannel(makeGuild({}));

        expect(result).toBeNull();
    });

    test('returns null when no logChannelId and no category given', async () => {
        getGuildConfig.mockResolvedValue({ logChannelId: null });

        const result = await getLogChannel(makeGuild({}));

        expect(result).toBeNull();
    });

    test('falls back to logChannelId when no category-specific channel is set', async () => {
        getGuildConfig.mockResolvedValue({ logChannelId: 'general', moderationLogChannelId: null });
        const guild = makeGuild({ general: { id: 'general' } });

        const result = await getLogChannel(guild, 'moderation');

        expect(result).toEqual({ id: 'general' });
    });

    test('prefers the category-specific channel over logChannelId', async () => {
        getGuildConfig.mockResolvedValue({ logChannelId: 'general', moderationLogChannelId: 'modlog' });
        const guild = makeGuild({ general: { id: 'general' }, modlog: { id: 'modlog' } });

        const result = await getLogChannel(guild, 'moderation');

        expect(result).toEqual({ id: 'modlog' });
    });

    test('returns null when the configured channel id is not in the guild cache', async () => {
        getGuildConfig.mockResolvedValue({ logChannelId: 'missing' });

        const result = await getLogChannel(makeGuild({}));

        expect(result).toBeNull();
    });
});
