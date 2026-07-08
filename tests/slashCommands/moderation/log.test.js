jest.mock('../../../utils/guildConfig', () => ({ updateGuildConfig: jest.fn() }));

const { updateGuildConfig } = require('../../../utils/guildConfig');
const log = require('../../../slashCommands/moderation/log');

function makeInteraction({ sub, channel = { id: 'c1', toString: () => '#logs' } } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getChannel: jest.fn().mockReturnValue(channel),
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

    test('set: saves the log channel', async () => {
        const interaction = makeInteraction({ sub: 'set' });

        await log.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { logChannelId: 'c1' });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Log channel set to') })
        );
    });

    test('unset: disables logging', async () => {
        const interaction = makeInteraction({ sub: 'unset' });

        await log.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { logChannelId: null });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Event logging has been disabled.' })
        );
    });
});
