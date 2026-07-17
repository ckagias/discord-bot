jest.mock('../../../utils/guildConfig', () => ({ updateGuildConfig: jest.fn() }));

const { updateGuildConfig } = require('../../../utils/guildConfig');
const farewell = require('../../../slashCommands/moderation/farewell');

function makeInteraction({ sub, channel = { id: 'c1', toString: () => '#farewell' }, message = null }: { sub: string; channel?: any; message?: string | null }) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getChannel: jest.fn().mockReturnValue(channel),
            getString: jest.fn().mockReturnValue(message),
        },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('farewell command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('set: saves the channel only when no custom message is given', async () => {
        const interaction = makeInteraction({ sub: 'set', message: null });

        await farewell.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { farewellChannelId: 'c1' });
    });

    test('set: saves both the channel and custom message when provided', async () => {
        const interaction = makeInteraction({ sub: 'set', message: '{user} left.' });

        await farewell.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { farewellChannelId: 'c1', farewellMessage: '{user} left.' });
    });

    test('unset: clears the channel and message', async () => {
        const interaction = makeInteraction({ sub: 'unset' });

        await farewell.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { farewellChannelId: null, farewellMessage: null });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Farewell messages have been disabled.' })
        );
    });
});
