jest.mock('../../../utils/guildConfig', () => ({ updateGuildConfig: jest.fn() }));

const { updateGuildConfig } = require('../../../utils/guildConfig');
const levelchannel = require('../../../slashCommands/leveling/levelchannel');

function makeInteraction({ sub, channel = { id: 'c1', toString: () => '#level-up' } } = {}) {
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

describe('levelchannel command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('set: saves the level-up channel', async () => {
        const interaction = makeInteraction({ sub: 'set' });

        await levelchannel.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { levelUpChannelId: 'c1' });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('will now post in') })
        );
    });

    test('reset: clears the dedicated channel', async () => {
        const interaction = makeInteraction({ sub: 'reset' });

        await levelchannel.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { levelUpChannelId: null });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('where the member chatted') })
        );
    });
});
