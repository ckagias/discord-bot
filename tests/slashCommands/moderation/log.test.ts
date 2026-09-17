jest.mock('../../../utils/guildConfig', () => ({ updateGuildConfig: jest.fn() }));

const { updateGuildConfig } = require('../../../utils/guildConfig');
const log = require('../../../slashCommands/moderation/log');

function makeInteraction({ sub, category = null, channel = { id: 'c1', toString: () => '#logs' } }: { sub: string; category?: string | null; channel?: any }) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getChannel: jest.fn().mockReturnValue(channel),
            getString: jest.fn().mockReturnValue(category),
        },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('log command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('set: saves the log channel for all categories by default', async () => {
        const interaction = makeInteraction({ sub: 'set' });

        await log.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { logChannelId: 'c1' });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('log channel set to') })
        );
    });

    test('set: routes to the category-specific field when given', async () => {
        const interaction = makeInteraction({ sub: 'set', category: 'moderation' });

        await log.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { moderationLogChannelId: 'c1' });
    });

    test('unset: disables logging for all categories by default', async () => {
        const interaction = makeInteraction({ sub: 'unset' });

        await log.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { logChannelId: null });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('logging has been disabled.') })
        );
    });

    test('unset: disables logging for a specific category when given', async () => {
        const interaction = makeInteraction({ sub: 'unset', category: 'voice' });

        await log.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { voiceLogChannelId: null });
    });
});
