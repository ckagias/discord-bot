const { PASSIVE_CREDITS_MIN, PASSIVE_CREDITS_MAX, rollPassiveCredits } = require('../../utils/passiveCredits');
const { workResponses } = require('../../data/responses');

describe('rollPassiveCredits', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('lowest roll gives the minimum', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);
        expect(rollPassiveCredits()).toBe(PASSIVE_CREDITS_MIN);
    });

    test('highest roll gives the maximum', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.999999);
        expect(rollPassiveCredits()).toBe(PASSIVE_CREDITS_MAX);
    });

    test('range is 1 to 3 credits', () => {
        expect(PASSIVE_CREDITS_MIN).toBe(1);
        expect(PASSIVE_CREDITS_MAX).toBe(3);
    });
});

describe('passive credits against /work', () => {
    // Passive credits are awarded at most once a minute, /work once an hour.
    test('chatting every minute for an hour pays less than one /work on average', () => {
        const passivePerHour = 60 * (PASSIVE_CREDITS_MIN + PASSIVE_CREDITS_MAX) / 2;
        const workAverage = workResponses.reduce((sum, job) => sum + (job.min + job.max) / 2, 0) / workResponses.length;
        expect(passivePerHour).toBeLessThan(workAverage);
    });
});
