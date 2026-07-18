jest.mock('../../models/StarboardSchema', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));
jest.mock('../../utils/guildConfig', () => ({
    getGuildConfig: jest.fn(),
}));

const StarboardSchema = require('../../models/StarboardSchema');
const { getGuildConfig } = require('../../utils/guildConfig');
const { handleStarReaction } = require('../../utils/starboard');

function makeReaction({ count = 5, existingReaction, author = { tag: 'user#0001', displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png' } }: { count?: number; existingReaction?: any; author?: any } = {}) {
    const starboardChannel = {
        isTextBased: () => true,
        send: jest.fn().mockResolvedValue({ id: 'posted1', delete: jest.fn().mockResolvedValue(undefined) }),
        messages: { fetch: jest.fn().mockResolvedValue(null) },
    };
    const guild = {
        id: 'g1',
        channels: { cache: { get: jest.fn().mockReturnValue(starboardChannel) } },
    };
    return {
        partial: false,
        message: {
            partial: false,
            guild,
            id: 'msg1',
            channel: { id: 'chan1' },
            author,
            content: 'hello',
            createdAt: new Date(),
            attachments: { find: jest.fn().mockReturnValue(undefined) },
            reactions: { cache: { get: jest.fn().mockReturnValue({ count }) } },
        },
        emoji: { id: null, name: '⭐' },
        starboardChannel,
    };
}

describe('handleStarReaction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getGuildConfig.mockResolvedValue({
            starboardEnabled: true,
            starboardChannelId: 'starboard1',
            starboardEmoji: '⭐',
            starboardThreshold: 3,
            starboardIgnoreNsfw: false,
        });
        StarboardSchema.findOne.mockResolvedValue(null);
        StarboardSchema.create.mockResolvedValue({});
    });

    test('posts a new starboard entry once the threshold is met', async () => {
        const reaction = makeReaction({ count: 5 });

        await handleStarReaction(reaction);

        expect(reaction.starboardChannel.send).toHaveBeenCalled();
        expect(StarboardSchema.create).toHaveBeenCalledWith(expect.objectContaining({ guildId: 'g1', messageId: 'msg1' }));
    });

    test('deletes its own duplicate post when create loses the unique-index race', async () => {
        const reaction = makeReaction({ count: 5 });
        const dupError: any = new Error('duplicate key');
        dupError.code = 11000;
        StarboardSchema.create.mockRejectedValue(dupError);

        await handleStarReaction(reaction);

        const posted = await reaction.starboardChannel.send.mock.results[0].value;
        expect(posted.delete).toHaveBeenCalled();
    });

    test('does not post below the threshold', async () => {
        const reaction = makeReaction({ count: 1 });

        await handleStarReaction(reaction);

        expect(reaction.starboardChannel.send).not.toHaveBeenCalled();
    });
});
