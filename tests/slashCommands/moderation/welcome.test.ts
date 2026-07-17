jest.mock('../../../utils/guildConfig', () => ({ updateGuildConfig: jest.fn() }));

const { updateGuildConfig } = require('../../../utils/guildConfig');
const welcome = require('../../../slashCommands/moderation/welcome');

function makeInteraction({ sub, channel = { id: 'c1', toString: () => '#welcome' }, message = null }: { sub: string; channel?: any; message?: string | null }) {
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

describe('welcome command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('set: saves the channel only when no custom message is given', async () => {
        const interaction = makeInteraction({ sub: 'set', message: null });

        await welcome.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { welcomeChannelId: 'c1' });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('{server}') })
        );
    });

    test('set: saves both the channel and custom message when provided', async () => {
        const interaction = makeInteraction({ sub: 'set', message: 'Hey {user}!' });

        await welcome.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { welcomeChannelId: 'c1', welcomeMessage: 'Hey {user}!' });
    });

    test('unset: clears the channel and message', async () => {
        const interaction = makeInteraction({ sub: 'unset' });

        await welcome.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { welcomeChannelId: null, welcomeMessage: null });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Welcome messages have been disabled.' })
        );
    });
});
