const { ChannelType } = require('discord.js');
const server = require('../../../slashCommands/info/server');

function makeCollection(items) {
    const map = new Map(items.map((item, i) => [i, item]));
    map.filter = (fn) => makeCollection([...map.values()].filter(fn));
    return map;
}

function makeInteraction({ sub, icon = 'https://example.com/icon.png', banner = null } = {}) {
    return {
        options: { getSubcommand: jest.fn().mockReturnValue(sub) },
        guild: {
            name: 'Test Guild',
            ownerId: 'owner1',
            createdTimestamp: Date.now(),
            verificationLevel: 'MEDIUM',
            premiumSubscriptionCount: 5,
            memberCount: 100,
            members: { cache: makeCollection([{ user: { bot: false } }, { user: { bot: true } }]) },
            roles: { cache: { size: 10 } },
            emojis: { cache: makeCollection([{ animated: true }, { animated: false }]) },
            stickers: { cache: { size: 3 } },
            channels: { fetch: jest.fn().mockResolvedValue(makeCollection([{ type: ChannelType.GuildText }, { type: ChannelType.GuildVoice }])) },
            iconURL: jest.fn().mockReturnValue(icon),
            bannerURL: jest.fn().mockReturnValue(banner),
        },
        user: { tag: 'User#0001', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/user.png') },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('server command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('info: shows server stats', async () => {
        const interaction = makeInteraction({ sub: 'info' });

        await server.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    describe('icon', () => {
        test('rejects when the server has no icon', async () => {
            const interaction = makeInteraction({ sub: 'icon', icon: null });

            await server.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'This server has no icon.' })
            );
        });

        test('shows the icon when present', async () => {
            const interaction = makeInteraction({ sub: 'icon' });

            await server.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('banner', () => {
        test('rejects when the server has no banner', async () => {
            const interaction = makeInteraction({ sub: 'banner', banner: null });

            await server.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('no banner') })
            );
        });

        test('shows the banner when present', async () => {
            const interaction = makeInteraction({ sub: 'banner', banner: 'https://example.com/banner.png' });

            await server.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });
});
