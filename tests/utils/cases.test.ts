jest.mock('../../models/CaseSchema', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn() }));

import CaseSchema from '../../models/CaseSchema';
import { createCase, logModAction } from '../../utils/cases';
import { getLogChannel } from '../../utils/logger';

const mockedCaseSchema = CaseSchema as any;
const mockedGetLogChannel = getLogChannel as jest.Mock;

function makeUser(id: string, tag: string) {
    return { id, tag, toString: () => `<@${id}>`, displayAvatarURL: () => 'https://example.com/avatar.png' };
}

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

describe('logModAction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('does nothing when no moderation log channel is configured', async () => {
        mockedGetLogChannel.mockResolvedValue(null);

        await logModAction({
            guild: { id: 'g1' } as any,
            action: 'Kick',
            target: makeUser('u1', 'Target#0001') as any,
            moderator: makeUser('m1', 'Mod#0001') as any,
            reason: 'test',
            caseId: 1,
        });

        expect(mockedGetLogChannel).toHaveBeenCalledWith({ id: 'g1' }, 'moderation');
    });

    test('posts an embed with user, moderator, action, reason, and case number', async () => {
        const send = jest.fn().mockResolvedValue({});
        mockedGetLogChannel.mockResolvedValue({ send });

        await logModAction({
            guild: { id: 'g1' } as any,
            action: 'Ban',
            target: makeUser('u1', 'Target#0001') as any,
            moderator: makeUser('m1', 'Mod#0001') as any,
            reason: 'spamming',
            caseId: 5,
        });

        expect(send).toHaveBeenCalledTimes(1);
        const embed = send.mock.calls[0][0].embeds[0].data;
        expect(embed.footer.text).toBe('Case #5');
        expect(embed.fields).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'User', value: expect.stringContaining('u1') }),
                expect.objectContaining({ name: 'Moderator', value: expect.stringContaining('m1') }),
                expect.objectContaining({ name: 'Action', value: 'Ban' }),
                expect.objectContaining({ name: 'Reason', value: 'spamming' }),
            ])
        );
    });

    test('includes a duration field only when a duration is given', async () => {
        const send = jest.fn().mockResolvedValue({});
        mockedGetLogChannel.mockResolvedValue({ send });

        await logModAction({
            guild: { id: 'g1' } as any,
            action: 'Mute',
            target: makeUser('u1', 'Target#0001') as any,
            moderator: makeUser('m1', 'Mod#0001') as any,
            reason: 'test',
            caseId: 2,
            duration: '10 minutes',
        });

        const embed = send.mock.calls[0][0].embeds[0].data;
        expect(embed.fields).toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'Duration', value: '10 minutes' })])
        );
    });

    test('swallows send failures instead of throwing', async () => {
        const send = jest.fn().mockRejectedValue(new Error('missing permissions'));
        mockedGetLogChannel.mockResolvedValue({ send });

        await expect(
            logModAction({
                guild: { id: 'g1' } as any,
                action: 'Kick',
                target: makeUser('u1', 'Target#0001') as any,
                moderator: makeUser('m1', 'Mod#0001') as any,
                reason: 'test',
                caseId: 3,
            })
        ).resolves.toBeUndefined();
    });
});
