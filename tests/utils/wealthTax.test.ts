jest.mock('../../models/EconomySchema', () => ({
    updateMany: jest.fn(),
}));
jest.mock('../../utils/log', () => {
    const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
    return Object.assign({ ...logger }, { scope: () => logger, __logger: logger });
});

const EconomySchema = require('../../models/EconomySchema');
const {
    WEALTH_TAX_THRESHOLD,
    WEALTH_TAX_RATE,
    WEALTH_TAX_INTERVAL_MS,
    WEALTH_TAX_CHECK_MS,
    wealthTaxFor,
    applyWealthTax,
} = require('../../utils/wealthTax');

describe('wealthTaxFor', () => {
    test('pins the threshold, rate and schedule', () => {
        expect(WEALTH_TAX_THRESHOLD).toBe(10_000);
        expect(WEALTH_TAX_RATE).toBe(0.02);
        expect(WEALTH_TAX_INTERVAL_MS).toBe(86_400_000);
        expect(WEALTH_TAX_CHECK_MS).toBe(3_600_000);
    });

    test('does not tax balances at or below the threshold', () => {
        expect(wealthTaxFor(0)).toBe(0);
        expect(wealthTaxFor(9_999)).toBe(0);
        expect(wealthTaxFor(10_000)).toBe(0);
    });

    test('takes 2% of only the amount above the threshold, rounded down', () => {
        expect(wealthTaxFor(110_000)).toBe(2_000);
        expect(wealthTaxFor(60_000)).toBe(1_000);
        expect(wealthTaxFor(10_049)).toBe(0);
        expect(wealthTaxFor(10_050)).toBe(1);
    });

    test('never takes the whole balance, so a wallet cannot be drained', () => {
        for (const balance of [10_001, 50_000, 1_000_000, 10 ** 9]) {
            expect(wealthTaxFor(balance)).toBeLessThan(balance - WEALTH_TAX_THRESHOLD + 1);
        }
    });

    // Income per day / rate = how far above the threshold a balance can climb before the tax cancels the income.
    test('an active player earning about 1,500 a day settles near 85,000', () => {
        let balance = 10_000;
        for (let day = 0; day < 1_000; day++) balance += 1_500 - wealthTaxFor(balance + 1_500);
        expect(balance).toBeGreaterThan(80_000);
        expect(balance).toBeLessThan(90_000);
    });
});

describe('applyWealthTax', () => {
    const now = new Date('2026-10-26T12:00:00Z').getTime();

    beforeEach(() => {
        jest.clearAllMocks();
        EconomySchema.updateMany.mockResolvedValue({ modifiedCount: 3 });
    });

    test('only matches wallets above the threshold that were never taxed or were taxed over 24 hours ago', async () => {
        await applyWealthTax(now);

        const [filter] = EconomySchema.updateMany.mock.calls[0];
        expect(filter).toEqual({
            balance: { $gt: 10_000 },
            $or: [{ lastTaxedAt: null }, { lastTaxedAt: { $lte: new Date(now - 86_400_000) } }],
        });
    });

    test('subtracts the floored 2% of the excess and stamps lastTaxedAt in one pipeline update', async () => {
        await applyWealthTax(now);

        const [, update, options] = EconomySchema.updateMany.mock.calls[0];
        expect(options).toEqual({ updatePipeline: true });
        expect(update).toEqual([{
            $set: {
                balance: {
                    $subtract: [
                        '$balance',
                        { $floor: { $multiply: [{ $subtract: ['$balance', 10_000] }, 0.02] } },
                    ],
                },
                lastTaxedAt: new Date(now),
            },
        }]);
    });

    test('returns the number of wallets taxed', async () => {
        await expect(applyWealthTax(now)).resolves.toBe(3);
    });
});

describe('startWealthTax', () => {
    // The module keeps one timer, so each test loads a fresh copy of it together with its mocks.
    let start: () => void;
    let updateMany: jest.Mock;
    let logger: Record<string, jest.Mock>;

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        updateMany = require('../../models/EconomySchema').updateMany;
        logger = require('../../utils/log').__logger;
        updateMany.mockResolvedValue({ modifiedCount: 0 });
        start = require('../../utils/wealthTax').startWealthTax;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('sweeps once on start, then every hour, and only starts one timer', async () => {
        start();
        start();
        expect(updateMany).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(WEALTH_TAX_CHECK_MS);
        expect(updateMany).toHaveBeenCalledTimes(2);

        await jest.advanceTimersByTimeAsync(WEALTH_TAX_CHECK_MS * 2);
        expect(updateMany).toHaveBeenCalledTimes(4);
    });

    test('logs the count when wallets were taxed', async () => {
        updateMany.mockResolvedValue({ modifiedCount: 5 });

        start();
        await jest.advanceTimersByTimeAsync(0);

        expect(logger.info).toHaveBeenCalledWith('Taxed 5 wallet(s).');
    });

    test('logs an error instead of throwing when a sweep fails', async () => {
        updateMany.mockRejectedValue(new Error('db down'));

        start();
        await jest.advanceTimersByTimeAsync(0);

        expect(logger.error).toHaveBeenCalledWith('Wealth tax sweep failed:', expect.any(Error));
    });
});
