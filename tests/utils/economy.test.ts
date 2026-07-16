jest.mock('../../models/EconomySchema', () => ({ findOneAndUpdate: jest.fn() }));

import EconomySchema from '../../models/EconomySchema';
import { claimCooldown } from '../../utils/economy';

const mockedEconomySchema = EconomySchema as any;

describe('claimCooldown', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('atomically checks the cooldown field and stamps it in one operation', async () => {
        mockedEconomySchema.findOneAndUpdate.mockResolvedValue({ balance: 100 });

        await claimCooldown('user1', 'g1', 'lastRobAt', 3_600_000);

        expect(mockedEconomySchema.findOneAndUpdate).toHaveBeenCalledWith(
            {
                userId: 'user1',
                guildId: 'g1',
                $or: [{ lastRobAt: null }, { lastRobAt: { $lte: expect.any(Date) } }],
            },
            { $set: { lastRobAt: expect.any(Date) } },
            { returnDocument: 'after' }
        );
    });

    test('returns null when another concurrent call already claimed the cooldown', async () => {
        mockedEconomySchema.findOneAndUpdate.mockResolvedValue(null);

        const result = await claimCooldown('user1', 'g1', 'lastRobAt', 3_600_000);

        expect(result).toBeNull();
    });

    test('merges extra $set fields alongside the cooldown stamp', async () => {
        mockedEconomySchema.findOneAndUpdate.mockResolvedValue({ balance: 100 });

        await claimCooldown('user1', 'g1', 'lastDailyAt', 86_400_000, { $set: { dailyStreak: 3 } });

        expect(mockedEconomySchema.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'user1' }),
            { $set: { lastDailyAt: expect.any(Date), dailyStreak: 3 } },
            { returnDocument: 'after' }
        );
    });

    test('applies an extra $inc alongside the cooldown stamp', async () => {
        mockedEconomySchema.findOneAndUpdate.mockResolvedValue({ balance: 600 });

        await claimCooldown('user1', 'g1', 'lastWorkAt', 3_600_000, { $inc: { balance: 500 } });

        expect(mockedEconomySchema.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'user1' }),
            { $set: { lastWorkAt: expect.any(Date) }, $inc: { balance: 500 } },
            { returnDocument: 'after' }
        );
    });
});
