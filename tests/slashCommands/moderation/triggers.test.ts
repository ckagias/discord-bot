jest.mock('../../../models/TriggerSchema', () => ({ find: jest.fn() }));

const TriggerSchema = require('../../../models/TriggerSchema');
const triggers = require('../../../slashCommands/moderation/triggers');

function makeInteraction() {
    return {
        guild: { id: 'g1', name: 'Test Guild' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('triggers command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('reports no triggers configured', async () => {
        const interaction = makeInteraction();
        TriggerSchema.find.mockResolvedValue([]);

        await triggers.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('No triggers configured') })
        );
    });

    test('lists configured triggers', async () => {
        const interaction = makeInteraction();
        TriggerSchema.find.mockResolvedValue([{ trigger: 'hello', response: 'hi' }]);

        await triggers.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
