jest.mock('../../../models/EconomySchema', () => ({
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
}));

const EconomySchema = require('../../../models/EconomySchema');
const { DAILY_COOLDOWN_MS, dailyStreakAmount } = require('../../../utils/economy');
const daily = require('../../../slashCommands/economy/daily');

function makeInteraction() {
    return {
        user: { id: 'user1' },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('daily command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('blocks the claim and reports time remaining when still on cooldown', async () => {
        const interaction = makeInteraction();
        const lastDailyAt = new Date(Date.now() - 1000);
        EconomySchema.findOneAndUpdate.mockResolvedValueOnce({ lastDailyAt, dailyStreak: 2 });

        await daily.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('already claimed your daily credits') })
        );
        expect(EconomySchema.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    test('pays out day-1 streak amount on a first-ever claim', async () => {
        const interaction = makeInteraction();
        EconomySchema.findOneAndUpdate
            .mockResolvedValueOnce({ lastDailyAt: null, dailyStreak: 0 })
            .mockResolvedValueOnce({ balance: dailyStreakAmount(1) });

        await daily.execute(interaction);

        const [, update] = EconomySchema.findOneAndUpdate.mock.calls[1];
        expect(update.$set.dailyStreak).toBe(1);
        expect(update.$inc.balance).toBe(dailyStreakAmount(1));
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('increments the streak when claimed within the streak window', async () => {
        const interaction = makeInteraction();
        const lastDailyAt = new Date(Date.now() - DAILY_COOLDOWN_MS - 1000);
        EconomySchema.findOneAndUpdate
            .mockResolvedValueOnce({ lastDailyAt, dailyStreak: 3 })
            .mockResolvedValueOnce({ balance: dailyStreakAmount(4) });

        await daily.execute(interaction);

        const [, update] = EconomySchema.findOneAndUpdate.mock.calls[1];
        expect(update.$set.dailyStreak).toBe(4);
        expect(update.$inc.balance).toBe(dailyStreakAmount(4));
    });

    test('resets the streak to 1 when the claim window has expired', async () => {
        const interaction = makeInteraction();
        const lastDailyAt = new Date(Date.now() - DAILY_COOLDOWN_MS - 172_800_000 - 1000);
        EconomySchema.findOneAndUpdate
            .mockResolvedValueOnce({ lastDailyAt, dailyStreak: 5 })
            .mockResolvedValueOnce({ balance: dailyStreakAmount(1) });

        await daily.execute(interaction);

        const [, update] = EconomySchema.findOneAndUpdate.mock.calls[1];
        expect(update.$set.dailyStreak).toBe(1);
    });

    test('reports already-claimed when a concurrent claim wins the atomic update race', async () => {
        const interaction = makeInteraction();
        const lastDailyAt = new Date(Date.now() - DAILY_COOLDOWN_MS - 1000);
        EconomySchema.findOneAndUpdate
            .mockResolvedValueOnce({ lastDailyAt, dailyStreak: 1 })
            .mockResolvedValueOnce(null);
        EconomySchema.findOne.mockResolvedValueOnce({ lastDailyAt: new Date() });

        await daily.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('already claimed your daily credits') })
        );
    });
});
