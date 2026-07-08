jest.mock('../../../models/EconomySchema', () => ({
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
}));
jest.mock('../../../data/responses', () => ({
    workResponses: [{ text: 'You did a job.', min: 50, max: 50 }],
}));

const EconomySchema = require('../../../models/EconomySchema');
const work = require('../../../slashCommands/economy/work');

function makeInteraction() {
    return {
        user: { id: 'user1' },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('work command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('blocks work and reports time remaining when still on cooldown', async () => {
        const interaction = makeInteraction();
        EconomySchema.findOneAndUpdate.mockResolvedValueOnce({ lastWorkAt: new Date() });

        await work.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("tired from your last job") })
        );
        expect(EconomySchema.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    test('pays out earnings and stamps the cooldown when off cooldown', async () => {
        const interaction = makeInteraction();
        EconomySchema.findOneAndUpdate
            .mockResolvedValueOnce({ lastWorkAt: null })
            .mockResolvedValueOnce({ balance: 550 });

        await work.execute(interaction);

        const [, update] = EconomySchema.findOneAndUpdate.mock.calls[1];
        expect(update.$inc.balance).toBe(50);
        expect(update.$set.lastWorkAt).toBeInstanceOf(Date);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports still-tired when a concurrent claim wins the atomic update race', async () => {
        const interaction = makeInteraction();
        EconomySchema.findOneAndUpdate
            .mockResolvedValueOnce({ lastWorkAt: null })
            .mockResolvedValueOnce(null);
        EconomySchema.findOne.mockResolvedValueOnce({ lastWorkAt: new Date() });

        await work.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("tired from your last job") })
        );
    });
});
