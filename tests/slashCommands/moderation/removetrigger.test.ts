jest.mock('../../../models/TriggerSchema', () => ({ deleteOne: jest.fn() }));

const TriggerSchema = require('../../../models/TriggerSchema');
const removetrigger = require('../../../slashCommands/moderation/removetrigger');

function makeInteraction({ trigger = 'HELLO' } = {}) {
    return {
        options: { getString: jest.fn().mockReturnValue(trigger) },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('removetrigger command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('lowercases the trigger before deleting', async () => {
        const interaction = makeInteraction({ trigger: 'HELLO' });
        TriggerSchema.deleteOne.mockResolvedValue({ deletedCount: 1 });

        await removetrigger.execute(interaction);

        expect(TriggerSchema.deleteOne).toHaveBeenCalledWith({ guildId: 'g1', trigger: 'hello' });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Removed trigger') })
        );
    });

    test('reports when no matching trigger was found', async () => {
        const interaction = makeInteraction();
        TriggerSchema.deleteOne.mockResolvedValue({ deletedCount: 0 });

        await removetrigger.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('No trigger found') })
        );
    });
});
