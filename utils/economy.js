const EconomySchema = require('../models/EconomySchema');
const { upsertWithRetry } = require('./upsertRetry');

const DAILY_AMOUNT = 500;
const DAILY_COOLDOWN_MS = 86_400_000;  // 24 hours
const DAILY_STREAK_WINDOW_MS = 172_800_000; // 48 hours — claim within this window to keep streak alive

// Returns the payout for a given streak day (capped at day 7+).
function dailyStreakAmount(streak) {
    const multipliers = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.5];
    const m = multipliers[Math.min(streak - 1, multipliers.length - 1)] ?? 1;
    return Math.floor(DAILY_AMOUNT * m);
}

function getWallet(userId, guildId) {
    return upsertWithRetry(
        EconomySchema,
        { userId, guildId },
        { $setOnInsert: { userId, guildId } },
        { returnDocument: 'after' }
    );
}

// Atomically add `amount` (negative to subtract) to a user's balance.
// Returns null if the resulting balance would go below 0 (insufficient funds).
async function updateBalance(userId, guildId, amount) {
    if (amount < 0) {
        const wallet = await EconomySchema.findOneAndUpdate(
            { userId, guildId, balance: { $gte: -amount } },
            { $inc: { balance: amount }, $setOnInsert: { userId, guildId } },
            { upsert: false, returnDocument: 'after' }
        );
        return wallet; // null if balance was too low
    }
    return upsertWithRetry(
        EconomySchema,
        { userId, guildId },
        { $inc: { balance: amount }, $setOnInsert: { userId, guildId } },
        { returnDocument: 'after' }
    );
}

function formatBalance(n) {
    return n.toLocaleString('en-US');
}

// Atomically checks a cooldown field and stamps it in one operation, closing the race where
// two concurrent calls both pass the cooldown check. Returns the updated wallet on success,
// or null if another call already claimed the cooldown first.
function claimCooldown(userId, guildId, cooldownField, cooldownMs, extraUpdate = {}) {
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

module.exports = { getWallet, updateBalance, formatBalance, claimCooldown, DAILY_AMOUNT, DAILY_COOLDOWN_MS, DAILY_STREAK_WINDOW_MS, dailyStreakAmount };
