jest.mock('../../../models/WarnSchema', () => ({ deleteMany: jest.fn() }));

const WarnSchema = require('../../../models/WarnSchema');
const clearwarnings = require('../../../slashCommands/moderation/clearwarnings');

function makeInteraction() {
    return {
        options: { getUser: jest.fn().mockReturnValue({ id: 'target1', tag: 'Target#0001' }) },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('clearwarnings command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('reports nothing to clear when there are no warnings', async () => {
        const interaction = makeInteraction();
        WarnSchema.deleteMany.mockResolvedValue({ deletedCount: 0 });

        await clearwarnings.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('no warnings to clear') })
        );
    });

    test('reports the number of warnings cleared', async () => {
        const interaction = makeInteraction();
        WarnSchema.deleteMany.mockResolvedValue({ deletedCount: 3 });

        await clearwarnings.execute(interaction);

        expect(WarnSchema.deleteMany).toHaveBeenCalledWith({ guildId: 'g1', userId: 'target1' });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Cleared **3**') })
        );
    });
});
