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

    // The first number is hidden until the player has chosen, so no choice can be informed by it. Over every
    // pair of rolls each choice wins 49.5%, loses 49.5% and ties 1%, which pays out exactly what it takes.
    test.each(['higher', 'lower'] as const)('always picking %s wins and loses equally often', (choice) => {
        let wins = 0;
        let losses = 0;
        let ties = 0;
        for (let first = 1; first <= 100; first++) {
            for (let second = 1; second <= 100; second++) {
                const outcome = resolveGamble(first, second, choice);
                if (outcome === 'win') wins++;
                else if (outcome === 'lose') losses++;
                else ties++;
            }
        }
        expect(wins).toBe(4950);
        expect(losses).toBe(4950);
        expect(ties).toBe(100);
    });
});
