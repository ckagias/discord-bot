jest.mock('../../../models/WarnSchema', () => ({ find: jest.fn() }));

const WarnSchema = require('../../../models/WarnSchema');
const warnings = require('../../../slashCommands/moderation/warnings');

function makeQuery(result: unknown) {
    return { sort: jest.fn().mockResolvedValue(result) };
}

function makeInteraction() {
    return {
        options: { getUser: jest.fn().mockReturnValue({ id: 'target1', tag: 'Target#0001' }) },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('warnings command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('reports no warnings', async () => {
        const interaction = makeInteraction();
        WarnSchema.find.mockReturnValue(makeQuery([]));

        await warnings.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('no warnings') })
        );
    });

    test('lists warnings oldest-first', async () => {
        const interaction = makeInteraction();
        const query = makeQuery([{ reason: 'spam', moderatorId: 'mod1', createdAt: Date.now() }]);
        WarnSchema.find.mockReturnValue(query);

        await warnings.execute(interaction);

        expect(query.sort).toHaveBeenCalledWith({ createdAt: 1 });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
