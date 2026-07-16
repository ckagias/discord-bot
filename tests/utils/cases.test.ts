jest.mock('../../models/CaseSchema', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));

import CaseSchema from '../../models/CaseSchema';
import { createCase } from '../../utils/cases';

const mockedCaseSchema = CaseSchema as any;

function makeSortable(result: unknown) {
    return { sort: jest.fn().mockResolvedValue(result) };
}

describe('createCase', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('starts numbering at 1 when the guild has no existing cases', async () => {
        mockedCaseSchema.findOne.mockReturnValue(makeSortable(null));
        mockedCaseSchema.create.mockResolvedValue({ caseId: 1 });

        await createCase({ guildId: 'g1', type: 'warn', userId: 'u1', moderatorId: 'm1', reason: 'test' });

        expect(mockedCaseSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: 'g1', caseId: 1 })
        );
    });

    test('numbers the next case one above the current highest', async () => {
        mockedCaseSchema.findOne.mockReturnValue(makeSortable({ caseId: 7 }));
        mockedCaseSchema.create.mockResolvedValue({ caseId: 8 });

        await createCase({ guildId: 'g1', type: 'ban', userId: 'u1', moderatorId: 'm1', reason: 'test' });

        expect(mockedCaseSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ caseId: 8 })
        );
    });

    test('reuses the freed number after the highest case was deleted', async () => {
        // Guild had cases up to #10, #10 was deleted, so the highest remaining is #9.
        mockedCaseSchema.findOne.mockReturnValue(makeSortable({ caseId: 9 }));
        mockedCaseSchema.create.mockResolvedValue({ caseId: 10 });

        await createCase({ guildId: 'g1', type: 'kick', userId: 'u1', moderatorId: 'm1', reason: 'test' });

        expect(mockedCaseSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ caseId: 10 })
        );
    });

    test('scopes numbering per guild', async () => {
        mockedCaseSchema.findOne.mockReturnValue(makeSortable(null));
        mockedCaseSchema.create.mockResolvedValue({ caseId: 1 });

        await createCase({ guildId: 'g2', type: 'warn', userId: 'u1', moderatorId: 'm1', reason: 'test' });

        expect(mockedCaseSchema.findOne).toHaveBeenCalledWith({ guildId: 'g2' });
    });

    test('retries with a recomputed number when a concurrent create wins the same case number', async () => {
        const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 });
        mockedCaseSchema.findOne
            .mockReturnValueOnce(makeSortable({ caseId: 5 }))
            .mockReturnValueOnce(makeSortable({ caseId: 6 })); // the concurrent case landed first
        mockedCaseSchema.create
            .mockRejectedValueOnce(duplicateKeyError)
            .mockResolvedValueOnce({ caseId: 7 });

        const result = await createCase({ guildId: 'g1', type: 'mute', userId: 'u1', moderatorId: 'm1', reason: 'test' });

        expect(mockedCaseSchema.create).toHaveBeenCalledTimes(2);
        expect(mockedCaseSchema.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ caseId: 6 }));
        expect(mockedCaseSchema.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ caseId: 7 }));
        expect(result).toEqual({ caseId: 7 });
    });

    test('propagates non-duplicate-key errors immediately without retrying', async () => {
        mockedCaseSchema.findOne.mockReturnValue(makeSortable(null));
        mockedCaseSchema.create.mockRejectedValue(new Error('connection lost'));

        await expect(
            createCase({ guildId: 'g1', type: 'warn', userId: 'u1', moderatorId: 'm1', reason: 'test' })
        ).rejects.toThrow('connection lost');
        expect(mockedCaseSchema.create).toHaveBeenCalledTimes(1);
    });

    test('gives up after repeated collisions instead of retrying forever', async () => {
        const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 });
        mockedCaseSchema.findOne.mockReturnValue(makeSortable({ caseId: 1 }));
        mockedCaseSchema.create.mockRejectedValue(duplicateKeyError);

        await expect(
            createCase({ guildId: 'g1', type: 'warn', userId: 'u1', moderatorId: 'm1', reason: 'test' })
        ).rejects.toThrow('Failed to allocate a case number');
    });
});
