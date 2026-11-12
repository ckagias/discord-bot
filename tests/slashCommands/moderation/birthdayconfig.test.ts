jest.mock('../../../utils/guildConfig', () => ({ updateGuildConfig: jest.fn() }));

const { updateGuildConfig } = require('../../../utils/guildConfig');
const birthdayconfig = require('../../../slashCommands/moderation/birthdayconfig');

function makeInteraction({ sub, channel = { id: 'c1', toString: () => '#birthdays' }, message = null, role = null, invokerPosition = 20 }: { sub: string; channel?: any; message?: string | null; role?: any; invokerPosition?: number }) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getChannel: jest.fn().mockReturnValue(channel),
            getString: jest.fn().mockReturnValue(message),
            getRole: jest.fn().mockReturnValue(role),
        },
        user: { id: 'invoker' },
        member: { roles: { highest: { position: invokerPosition } } },
        guild: { id: 'g1', ownerId: 'owner' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('birthdayconfig command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('set: saves the channel only when no message or role is given', async () => {
        const interaction = makeInteraction({ sub: 'set' });

        await birthdayconfig.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { birthdayChannelId: 'c1' });
    });

    test('set: saves channel, message, and role together', async () => {
        const role = { id: 'r1', position: 1, toString: () => '@Birthday' };
        const interaction = makeInteraction({ sub: 'set', message: 'Happy birthday {user}!', role });

        await birthdayconfig.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', {
            birthdayChannelId: 'c1',
            birthdayMessage: 'Happy birthday {user}!',
            birthdayRoleId: 'r1',
        });
    });

    test('unset: clears channel, message, and role', async () => {
        const interaction = makeInteraction({ sub: 'unset' });

        await birthdayconfig.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', {
            birthdayChannelId: null,
            birthdayMessage: null,
            birthdayRoleId: null,
        });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Birthday announcements have been disabled.' })
        );
    });

    test("set: rejects a role at or above the invoker's highest role and saves nothing", async () => {
        const role = { id: 'r1', position: 5, toString: () => '@Admin' };
        const interaction = makeInteraction({ sub: 'set', invokerPosition: 5, role });

        await birthdayconfig.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('higher than or equal to your highest role') })
        );
        expect(updateGuildConfig).not.toHaveBeenCalled();
    });
});
