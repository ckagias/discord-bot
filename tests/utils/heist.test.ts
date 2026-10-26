jest.mock('../../utils/economy', () => ({
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));
jest.mock('../../models/HeistSchema', () => ({
    findOneAndUpdate: jest.fn(),
}));

const { successChance, calcPayout } = require('../../utils/heist');

describe('successChance', () => {
    test('starts at 30% for a crew of one', () => {
        expect(successChance(1)).toBeCloseTo(0.30);
    });

    test('rises by 5% per extra member', () => {
        expect(successChance(2)).toBeCloseTo(0.35);
        expect(successChance(4)).toBeCloseTo(0.45);
        expect(successChance(7)).toBeCloseTo(0.60);
    });

    test('caps at 75% from a crew of ten', () => {
        expect(successChance(10)).toBeCloseTo(0.75);
        expect(successChance(11)).toBeCloseTo(0.75);
        expect(successChance(50)).toBeCloseTo(0.75);
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

    test('highest roll pays just under 3x the pot', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.999999);
        const { multiplier } = calcPayout(1000, 2);
        expect(multiplier).toBeGreaterThan(2.99);
        expect(multiplier).toBeLessThan(3);
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
