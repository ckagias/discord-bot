import EconomySchema from '../models/EconomySchema';
import log from './log';
const logger = log.scope('wealthTax');

// Credits above the threshold lose a share of the excess once a day, so balances settle where income equals tax.
// An active player earning ~1,500 a day settles near 10,000 + 1,500 / 0.02 = 85,000.
const WEALTH_TAX_THRESHOLD = 10_000;
const WEALTH_TAX_RATE = 0.02;
const WEALTH_TAX_INTERVAL_MS = 86_400_000;  // a wallet is taxed at most once per 24 hours
const WEALTH_TAX_CHECK_MS = 3_600_000;      // how often the sweep looks for wallets that are due

// What the next sweep will take from a wallet holding this balance.
function wealthTaxFor(balance: number): number {
    if (balance <= WEALTH_TAX_THRESHOLD) return 0;
    return Math.floor((balance - WEALTH_TAX_THRESHOLD) * WEALTH_TAX_RATE);
}

// One updateMany with a pipeline update, so each wallet is read and written in a single atomic operation and a
// concurrent /work or /gamble can't be overwritten. lastTaxedAt lives on the wallet, so a restart can't tax twice.
async function applyWealthTax(now = Date.now()): Promise<number> {
    const result = await EconomySchema.updateMany(
        {
            balance: { $gt: WEALTH_TAX_THRESHOLD },
            $or: [{ lastTaxedAt: null }, { lastTaxedAt: { $lte: new Date(now - WEALTH_TAX_INTERVAL_MS) } }],
        },
        [{
            $set: {
                balance: {
                    $subtract: [
                        '$balance',
                        { $floor: { $multiply: [{ $subtract: ['$balance', WEALTH_TAX_THRESHOLD] }, WEALTH_TAX_RATE] } },
                    ],
                },
                lastTaxedAt: new Date(now),
            },
        }],
        { updatePipeline: true }
    );
    return result.modifiedCount;
}

let timer: NodeJS.Timeout | null = null;

// Runs once now to cover days missed while offline, then keeps checking. lastTaxedAt keeps repeat runs harmless.
function startWealthTax() {
    if (timer) return;
    const run = () => applyWealthTax()
        .then(taxed => { if (taxed) logger.info(`Taxed ${taxed} wallet(s).`); })
        .catch(err => logger.error('Wealth tax sweep failed:', err));

    run();
    timer = setInterval(run, WEALTH_TAX_CHECK_MS);
    timer.unref();
}

export {
    WEALTH_TAX_THRESHOLD,
    WEALTH_TAX_RATE,
    WEALTH_TAX_INTERVAL_MS,
    WEALTH_TAX_CHECK_MS,
    wealthTaxFor,
    applyWealthTax,
    startWealthTax,
};
