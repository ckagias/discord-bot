jest.mock('../../../utils/guildConfig', () => ({ ensureGuildConfig: jest.fn() }));

const { ensureGuildConfig } = require('../../../utils/guildConfig');
const toggleleveling = require('../../../slashCommands/leveling/toggleleveling');

function makeInteraction() {
    return {
        guild: { id: 'g1', name: 'Test Guild' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('toggleleveling command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('flips disabled to enabled and persists', async () => {
        const interaction = makeInteraction();
        const guildData = { levelingEnabled: false, save: jest.fn().mockResolvedValue({}) };
        ensureGuildConfig.mockResolvedValue(guildData);

        await toggleleveling.execute(interaction);

        expect(guildData.levelingEnabled).toBe(true);
        expect(guildData.save).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Enabled') })
        );
    });

    test('flips enabled to disabled and persists', async () => {
        const interaction = makeInteraction();
        const guildData = { levelingEnabled: true, save: jest.fn().mockResolvedValue({}) };
        ensureGuildConfig.mockResolvedValue(guildData);

        await toggleleveling.execute(interaction);

        expect(guildData.levelingEnabled).toBe(false);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Disabled') })
        );
    });
});
