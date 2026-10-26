const { resolveGamble } = require('../../utils/gamble');

describe('resolveGamble', () => {
    test('a matching number is a tie regardless of the choice', () => {
        expect(resolveGamble(50, 50, 'higher')).toBe('tie');
        expect(resolveGamble(50, 50, 'lower')).toBe('tie');
    });

    test('higher wins when the second number is larger', () => {
        expect(resolveGamble(40, 41, 'higher')).toBe('win');
        expect(resolveGamble(40, 41, 'lower')).toBe('lose');
    });

    test('lower wins when the second number is smaller', () => {
        expect(resolveGamble(40, 39, 'lower')).toBe('win');
        expect(resolveGamble(40, 39, 'higher')).toBe('lose');
    });

    // The first number is shown before the player chooses, so a player who picks the likelier side every time
    // wins 74.5% of rounds and loses 24.5%. This pins that so a rebalance has to change the test on purpose.
    test('picking the better side every time wins 74.5% and loses 24.5% of rounds', () => {
        let wins = 0;
        let losses = 0;
        let ties = 0;
        for (let first = 1; first <= 100; first++) {
            const choice = 100 - first >= first - 1 ? 'higher' : 'lower';
            for (let second = 1; second <= 100; second++) {
                const outcome = resolveGamble(first, second, choice);
                if (outcome === 'win') wins++;
                else if (outcome === 'lose') losses++;
                else ties++;
            }
        }
        expect(wins).toBe(7450);
        expect(losses).toBe(2450);
        expect(ties).toBe(100);
    });

    test('always picking the same side is slightly under even', () => {
        let wins = 0;
        for (let first = 1; first <= 100; first++) {
            for (let second = 1; second <= 100; second++) {
                if (resolveGamble(first, second, 'higher') === 'win') wins++;
            }
        }
        expect(wins).toBe(4950);
    });
});
