jest.mock('../../../utils/guildConfig', () => ({ updateGuildConfig: jest.fn() }));

const { updateGuildConfig } = require('../../../utils/guildConfig');
const setmuterole = require('../../../slashCommands/moderation/setmuterole');

function makeInteraction({ rolePosition = 1, invokerPosition = 20 } = {}) {
    const role = { id: 'role1', position: rolePosition, toString: () => '@Muted' };
    return {
        options: { getRole: jest.fn().mockReturnValue(role) },
        user: { id: 'invoker' },
        member: { roles: { highest: { position: invokerPosition } } },
        guild: { id: 'g1', ownerId: 'owner' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('setmuterole command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('saves the mute role and confirms', async () => {
        const interaction = makeInteraction();

        await setmuterole.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { muteRoleId: 'role1' });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Mute role set to') })
        );
    });

    test("rejects a role at or above the invoker's highest role and saves nothing", async () => {
        const interaction = makeInteraction({ rolePosition: 5, invokerPosition: 5 });

        await setmuterole.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('higher than or equal to your highest role') })
        );
        expect(updateGuildConfig).not.toHaveBeenCalled();
    });
});
