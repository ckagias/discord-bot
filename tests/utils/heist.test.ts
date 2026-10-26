jest.mock('../../utils/economy', () => ({
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));
jest.mock('../../models/HeistSchema', () => ({
    findOneAndUpdate: jest.fn(),
}));

const {
    successChance,
    calcPayout,
    HEIST_MIN_MULTIPLIER,
    HEIST_MAX_MULTIPLIER,
} = require('../../utils/heist');

describe('successChance', () => {
    test('starts at 30% for a crew of one', () => {
        expect(successChance(1)).toBeCloseTo(0.30);
    });

    test('rises by 5% per extra member', () => {
        expect(successChance(2)).toBeCloseTo(0.35);
        expect(successChance(4)).toBeCloseTo(0.45);
        expect(successChance(5)).toBeCloseTo(0.50);
    });

    test('caps at 55% from a crew of six', () => {
        expect(successChance(6)).toBeCloseTo(0.55);
        expect(successChance(7)).toBeCloseTo(0.55);
        expect(successChance(50)).toBeCloseTo(0.55);
    });
});

describe('heist return', () => {
    const averageMultiplier = (HEIST_MIN_MULTIPLIER + HEIST_MAX_MULTIPLIER) / 2;

    // Crew return is chance x average multiplier: the credits paid out per credit staked.
    test('crews of two to five lose credits on average', () => {
        for (let crew = 2; crew <= 5; crew++) {
            expect(successChance(crew) * averageMultiplier).toBeLessThan(1);
        }
    });

    test('a full crew gains at most 5% on average', () => {
        const fullCrew = successChance(50) * averageMultiplier;
        expect(fullCrew).toBeGreaterThanOrEqual(1);
        expect(fullCrew).toBeLessThan(1.05);
    });

    test('multiplier range is 1.5x to 2.2x', () => {
        expect(HEIST_MIN_MULTIPLIER).toBe(1.5);
        expect(HEIST_MAX_MULTIPLIER).toBe(2.2);
    });
});

describe('calcPayout', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('lowest roll pays 1.5x the pot', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);
        const { multiplier, perPerson, remainder } = calcPayout(1000, 3);
        expect(multiplier).toBeCloseTo(1.5);
        expect(perPerson).toBe(500);
        expect(remainder).toBe(0);
    });

    test('highest roll pays just under 2.2x the pot', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.999999);
        const { multiplier } = calcPayout(1000, 2);
        expect(multiplier).toBeGreaterThan(2.19);
        expect(multiplier).toBeLessThan(2.2);
    });

    test('remainder from floor division is kept so no coins are lost', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);
        const { perPerson, remainder } = calcPayout(1001, 3);
        expect(perPerson).toBe(500);
        expect(remainder).toBe(1);
        expect(perPerson * 3 + remainder).toBe(Math.floor(1001 * 1.5));
    });

    test('a successful heist always pays out more than the pot', () => {
        for (const roll of [0, 0.25, 0.5, 0.75, 0.999999]) {
            jest.spyOn(Math, 'random').mockReturnValue(roll);
            const { perPerson, remainder } = calcPayout(1000, 4);
            expect(perPerson * 4 + remainder).toBeGreaterThan(1000);
            jest.restoreAllMocks();
        }
    });
});
