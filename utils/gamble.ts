type GambleChoice = 'higher' | 'lower';
type GambleOutcome = 'win' | 'lose' | 'tie';

function resolveGamble(firstNumber: number, secondNumber: number, choice: GambleChoice): GambleOutcome {
    if (secondNumber === firstNumber) return 'tie';
    const result: GambleChoice = secondNumber > firstNumber ? 'higher' : 'lower';
    return choice === result ? 'win' : 'lose';
}

export { resolveGamble };
export type { GambleChoice, GambleOutcome };
