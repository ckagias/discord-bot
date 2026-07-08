jest.mock('../../../models/CaseSchema', () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndDelete: jest.fn(),
}));

const CaseSchema = require('../../../models/CaseSchema');
const caseCmd = require('../../../slashCommands/moderation/case');

function makeQuery(result) {
    return { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(result) };
}

function makeInteraction({ sub, id = 1, user = { id: 'target1', tag: 'Target#0001' } } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getInteger: jest.fn().mockReturnValue(id),
            getUser: jest.fn().mockReturnValue(user),
        },
        guild: { id: 'g1' },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('case command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('lookup', () => {
        test('reports not found when the case does not exist', async () => {
            const interaction = makeInteraction({ sub: 'lookup', id: 99 });
            CaseSchema.findOne.mockResolvedValue(null);

            await caseCmd.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No case #99 found') })
            );
        });

        test('shows the case details including duration when present', async () => {
            const interaction = makeInteraction({ sub: 'lookup', id: 1 });
            CaseSchema.findOne.mockResolvedValue({
                caseId: 1, type: 'ban', userId: 'target1', moderatorId: 'mod1', reason: 'spam', duration: '7d', createdAt: new Date(),
            });

            await caseCmd.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('history', () => {
        test('reports no cases found', async () => {
            const interaction = makeInteraction({ sub: 'history' });
            CaseSchema.find.mockReturnValue(makeQuery([]));

            await caseCmd.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No cases found') })
            );
        });

        test('sorts newest-first and limits to 10', async () => {
            const interaction = makeInteraction({ sub: 'history' });
            const query = makeQuery([{ caseId: 1, type: 'warn', reason: 'r', createdAt: new Date() }]);
            CaseSchema.find.mockReturnValue(query);

            await caseCmd.execute(interaction);

            expect(query.sort).toHaveBeenCalledWith({ caseId: -1 });
            expect(query.limit).toHaveBeenCalledWith(10);
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('delete', () => {
        test('reports not found when the case does not exist', async () => {
            const interaction = makeInteraction({ sub: 'delete', id: 99 });
            CaseSchema.findOneAndDelete.mockResolvedValue(null);

            await caseCmd.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No case #99 found') })
            );
        });

        test('deletes the case and confirms', async () => {
            const interaction = makeInteraction({ sub: 'delete', id: 1 });
            CaseSchema.findOneAndDelete.mockResolvedValue({ caseId: 1, type: 'ban', userId: 'target1' });

            await caseCmd.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Deleted case #1') })
            );
        });
    });
});
