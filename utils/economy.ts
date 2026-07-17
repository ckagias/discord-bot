import EconomySchema from '../models/EconomySchema';
import { upsertWithRetry } from './upsertRetry';

const DAILY_AMOUNT = 500;
const DAILY_COOLDOWN_MS = 86_400_000;  // 24 hours
const DAILY_STREAK_WINDOW_MS = 172_800_000; // 48 hours — claim within this window to keep streak alive

// Returns the payout for a given streak day (capped at day 7+).
function dailyStreakAmount(streak: number): number {
    const multipliers = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.5];
    const m = multipliers[Math.min(streak - 1, multipliers.length - 1)] ?? 1;
    return Math.floor(DAILY_AMOUNT * m);
}

function getWallet(userId: string, guildId: string) {
    return upsertWithRetry(
        EconomySchema,
        { userId, guildId },
        { $setOnInsert: { userId, guildId } },
        { returnDocument: 'after' }
    );
}

// Returns null instead of going negative when subtracting more than the balance holds.
async function updateBalance(userId: string, guildId: string, amount: number) {
    if (amount < 0) {
        const wallet = await EconomySchema.findOneAndUpdate(
            { userId, guildId, balance: { $gte: -amount } },
            { $inc: { balance: amount }, $setOnInsert: { userId, guildId } },
            { upsert: false, returnDocument: 'after' }
        );
        return wallet;
    }
    return upsertWithRetry(
        EconomySchema,
        { userId, guildId },
        { $inc: { balance: amount }, $setOnInsert: { userId, guildId } },
        { returnDocument: 'after' }
    );
}

function formatBalance(n: number): string {
    return n.toLocaleString('en-US');
}

interface ExtraUpdate {
    $set?: Record<string, unknown>;
    $inc?: Record<string, unknown>;
}

// Check-and-stamp in one atomic op, closing the race between two concurrent cooldown claims.
function claimCooldown(userId: string, guildId: string, cooldownField: string, cooldownMs: number, extraUpdate: ExtraUpdate = {}) {
    const now = Date.now();
    return EconomySchema.findOneAndUpdate(
        {
            userId,
            guildId,
            $or: [{ [cooldownField]: null }, { [cooldownField]: { $lte: new Date(now - cooldownMs) } }],
        },
        {
            $set: { [cooldownField]: new Date(now), ...(extraUpdate.$set ?? {}) },
            ...(extraUpdate.$inc ? { $inc: extraUpdate.$inc } : {}),
        },
        { returnDocument: 'after' }
    );
}

export { getWallet, updateBalance, formatBalance, claimCooldown, DAILY_AMOUNT, DAILY_COOLDOWN_MS, DAILY_STREAK_WINDOW_MS, dailyStreakAmount };
