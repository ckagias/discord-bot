jest.mock('../../models/EconomySchema', () => ({ findOneAndUpdate: jest.fn() }));

import EconomySchema from '../../models/EconomySchema';
import { claimCooldown, getWallet, updateBalance, formatBalance, dailyStreakAmount } from '../../utils/economy';

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

describe('getWallet', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('upserts a wallet by userId and guildId', async () => {
        mockedEconomySchema.findOneAndUpdate.mockResolvedValue({ userId: 'user1', guildId: 'g1', balance: 0 });

        const result = await getWallet('user1', 'g1');

        expect(result).toEqual({ userId: 'user1', guildId: 'g1', balance: 0 });
        expect(mockedEconomySchema.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: 'user1', guildId: 'g1' },
            { $setOnInsert: { userId: 'user1', guildId: 'g1' } },
            { returnDocument: 'after', upsert: true }
        );
    });
});

describe('updateBalance', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('upserts and increments when adding a positive amount', async () => {
        mockedEconomySchema.findOneAndUpdate.mockResolvedValue({ balance: 600 });

        const result = await updateBalance('user1', 'g1', 500);

        expect(result).toEqual({ balance: 600 });
        expect(mockedEconomySchema.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: 'user1', guildId: 'g1' },
            { $inc: { balance: 500 }, $setOnInsert: { userId: 'user1', guildId: 'g1' } },
            { returnDocument: 'after', upsert: true }
        );
    });

    test('deducts a negative amount only when the balance can cover it, without upserting', async () => {
        mockedEconomySchema.findOneAndUpdate.mockResolvedValue({ balance: 400 });

        const result = await updateBalance('user1', 'g1', -100);

        expect(result).toEqual({ balance: 400 });
        expect(mockedEconomySchema.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: 'user1', guildId: 'g1', balance: { $gte: 100 } },
            { $inc: { balance: -100 }, $setOnInsert: { userId: 'user1', guildId: 'g1' } },
            { upsert: false, returnDocument: 'after' }
        );
    });

    test('returns null instead of going negative when the balance cannot cover the deduction', async () => {
        mockedEconomySchema.findOneAndUpdate.mockResolvedValue(null);

        const result = await updateBalance('user1', 'g1', -1000);

        expect(result).toBeNull();
    });
});

describe('formatBalance', () => {
    test('formats with thousands separators', () => {
        expect(formatBalance(1234567)).toBe('1,234,567');
    });

    test('formats zero and small numbers without separators', () => {
        expect(formatBalance(0)).toBe('0');
        expect(formatBalance(42)).toBe('42');
    });
});

describe('dailyStreakAmount', () => {
    test('returns the base amount on day 1', () => {
        expect(dailyStreakAmount(1)).toBe(500);
    });

    test('scales up with the streak multiplier table', () => {
        expect(dailyStreakAmount(2)).toBe(600);
        expect(dailyStreakAmount(7)).toBe(1750);
    });

    test('caps at the day-7 multiplier for longer streaks', () => {
        expect(dailyStreakAmount(7)).toBe(dailyStreakAmount(30));
    });
});
