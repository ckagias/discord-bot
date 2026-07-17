jest.mock('../../../utils/guildConfig', () => ({
    getGuildConfig: jest.fn(),
    updateGuildConfig: jest.fn(),
    ensureGuildConfig: jest.fn(),
}));

const { getGuildConfig, updateGuildConfig, ensureGuildConfig } = require('../../../utils/guildConfig');
const starboard = require('../../../slashCommands/settings/starboard');

function makeInteraction({ sub, channel = { id: 'c1', name: 'starboard' }, emoji = '⭐', count = 3 }: { sub?: string; channel?: { id: string; name: string }; emoji?: string; count?: number } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getChannel: jest.fn().mockReturnValue(channel),
            getString: jest.fn().mockReturnValue(emoji),
            getInteger: jest.fn().mockReturnValue(count),
        },
        guild: { id: 'g1', name: 'Test Guild', channels: { cache: { get: jest.fn().mockReturnValue(channel) } } },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('starboard command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('set: enables the starboard with the chosen channel', async () => {
        const interaction = makeInteraction({ sub: 'set' });

        await starboard.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { starboardChannelId: 'c1', starboardEnabled: true });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Starboard enabled') })
        );
    });

    test('emoji: trims and saves the emoji', async () => {
        const interaction = makeInteraction({ sub: 'emoji', emoji: '  🌟  ' });

        await starboard.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { starboardEmoji: '🌟' });
    });

    test('threshold: saves the minimum reaction count', async () => {
        const interaction = makeInteraction({ sub: 'threshold', count: 5 });

        await starboard.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { starboardThreshold: 5 });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('**5** reactions') })
        );
    });

    test('toggle: flips enabled to disabled and persists the change', async () => {
        const interaction = makeInteraction({ sub: 'toggle' });
        const guildData = { starboardEnabled: true, save: jest.fn().mockResolvedValue({}) };
        ensureGuildConfig.mockResolvedValue(guildData);

        await starboard.execute(interaction);

        expect(guildData.starboardEnabled).toBe(false);
        expect(guildData.save).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Disabled') })
        );
    });

    test('toggle: flips disabled to enabled', async () => {
        const interaction = makeInteraction({ sub: 'toggle' });
        const guildData = { starboardEnabled: false, save: jest.fn().mockResolvedValue({}) };
        ensureGuildConfig.mockResolvedValue(guildData);

        await starboard.execute(interaction);

        expect(guildData.starboardEnabled).toBe(true);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Enabled') })
        );
    });

    test('view: shows defaults when no config exists yet', async () => {
        const interaction = makeInteraction({ sub: 'view' });
        getGuildConfig.mockResolvedValue(null);

        await starboard.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('view: reflects the saved configuration', async () => {
        const interaction = makeInteraction({ sub: 'view' });
        getGuildConfig.mockResolvedValue({
            starboardEnabled: true,
            starboardChannelId: 'c1',
            starboardEmoji: '🌟',
            starboardThreshold: 5,
            starboardIgnoreNsfw: false,
        });

        await starboard.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
