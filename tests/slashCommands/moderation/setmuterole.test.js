jest.mock('../../../utils/guildConfig', () => ({ updateGuildConfig: jest.fn() }));

const { updateGuildConfig } = require('../../../utils/guildConfig');
const setmuterole = require('../../../slashCommands/moderation/setmuterole');

describe('setmuterole command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('saves the mute role and confirms', async () => {
        const role = { id: 'role1', toString: () => '@Muted' };
        const interaction = {
            options: { getRole: jest.fn().mockReturnValue(role) },
            guild: { id: 'g1' },
            deferReply: jest.fn().mockResolvedValue({}),
            editReply: jest.fn().mockResolvedValue({}),
        };

        await setmuterole.execute(interaction);

        expect(updateGuildConfig).toHaveBeenCalledWith('g1', { muteRoleId: 'role1' });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Mute role set to') })
        );
    });
});
