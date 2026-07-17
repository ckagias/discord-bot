jest.mock('../../../models/TriggerSchema', () => ({ findOne: jest.fn(), create: jest.fn() }));

const TriggerSchema = require('../../../models/TriggerSchema');
const addtrigger = require('../../../slashCommands/moderation/addtrigger');

function makeInteraction({ trigger = 'HELLO', response = 'Hi there!' } = {}) {
    return {
        options: { getString: jest.fn((opt) => (opt === 'trigger' ? trigger : response)) },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('addtrigger command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('lowercases the trigger before storing and checking', async () => {
        const interaction = makeInteraction({ trigger: 'HELLO' });
        TriggerSchema.findOne.mockResolvedValue(null);

        await addtrigger.execute(interaction);

        expect(TriggerSchema.findOne).toHaveBeenCalledWith({ guildId: 'g1', trigger: 'hello' });
        expect(TriggerSchema.create).toHaveBeenCalledWith({ guildId: 'g1', trigger: 'hello', response: 'Hi there!' });
    });

    test('rejects a duplicate trigger', async () => {
        const interaction = makeInteraction({ trigger: 'hello' });
        TriggerSchema.findOne.mockResolvedValue({ trigger: 'hello' });

        await addtrigger.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('already exists') })
        );
        expect(TriggerSchema.create).not.toHaveBeenCalled();
    });
});
