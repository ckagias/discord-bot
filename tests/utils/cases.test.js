jest.mock('../../models/CaseSchema', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));

const CaseSchema = require('../../models/CaseSchema');
const { createCase } = require('../../utils/cases');

function makeSortable(result) {
    return { sort: jest.fn().mockResolvedValue(result) };
}

describe('createCase', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('starts numbering at 1 when the guild has no existing cases', async () => {
        CaseSchema.findOne.mockReturnValue(makeSortable(null));
        CaseSchema.create.mockResolvedValue({ caseId: 1 });

        await createCase({ guildId: 'g1', type: 'warn', userId: 'u1', moderatorId: 'm1', reason: 'test' });

        expect(CaseSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: 'g1', caseId: 1 })
        );
    });

    test('numbers the next case one above the current highest', async () => {
        CaseSchema.findOne.mockReturnValue(makeSortable({ caseId: 7 }));
        CaseSchema.create.mockResolvedValue({ caseId: 8 });

        await createCase({ guildId: 'g1', type: 'ban', userId: 'u1', moderatorId: 'm1', reason: 'test' });

        expect(CaseSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ caseId: 8 })
        );
    });

    test('reuses the freed number after the highest case was deleted', async () => {
        // Guild had cases up to #10, #10 was deleted, so the highest remaining is #9.
        CaseSchema.findOne.mockReturnValue(makeSortable({ caseId: 9 }));
        CaseSchema.create.mockResolvedValue({ caseId: 10 });

        await createCase({ guildId: 'g1', type: 'kick', userId: 'u1', moderatorId: 'm1', reason: 'test' });

        expect(CaseSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ caseId: 10 })
        );
    });

    test('scopes numbering per guild', async () => {
        CaseSchema.findOne.mockReturnValue(makeSortable(null));
        CaseSchema.create.mockResolvedValue({ caseId: 1 });

        await createCase({ guildId: 'g2', type: 'warn', userId: 'u1', moderatorId: 'm1', reason: 'test' });

        expect(CaseSchema.findOne).toHaveBeenCalledWith({ guildId: 'g2' });
    });

    test('retries with a recomputed number when a concurrent create wins the same case number', async () => {
        const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 });
        CaseSchema.findOne
            .mockReturnValueOnce(makeSortable({ caseId: 5 }))
            .mockReturnValueOnce(makeSortable({ caseId: 6 })); // the concurrent case landed first
        CaseSchema.create
            .mockRejectedValueOnce(duplicateKeyError)
            .mockResolvedValueOnce({ caseId: 7 });

        const result = await createCase({ guildId: 'g1', type: 'mute', userId: 'u1', moderatorId: 'm1', reason: 'test' });

        expect(CaseSchema.create).toHaveBeenCalledTimes(2);
        expect(CaseSchema.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ caseId: 6 }));
        expect(CaseSchema.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ caseId: 7 }));
        expect(result).toEqual({ caseId: 7 });
    });

    test('propagates non-duplicate-key errors immediately without retrying', async () => {
        CaseSchema.findOne.mockReturnValue(makeSortable(null));
        CaseSchema.create.mockRejectedValue(new Error('connection lost'));

        await expect(
            createCase({ guildId: 'g1', type: 'warn', userId: 'u1', moderatorId: 'm1', reason: 'test' })
        ).rejects.toThrow('connection lost');
        expect(CaseSchema.create).toHaveBeenCalledTimes(1);
    });

    test('gives up after repeated collisions instead of retrying forever', async () => {
        const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 });
        CaseSchema.findOne.mockReturnValue(makeSortable({ caseId: 1 }));
        CaseSchema.create.mockRejectedValue(duplicateKeyError);

        await expect(
            createCase({ guildId: 'g1', type: 'warn', userId: 'u1', moderatorId: 'm1', reason: 'test' })
        ).rejects.toThrow('Failed to allocate a case number');
    });
});
