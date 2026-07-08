jest.mock('axios');
jest.mock('../../../models/WordleSchema', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../../../utils/economy', () => ({
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const axios = require('axios');
const WordleGame = require('../../../models/WordleSchema');
const { updateBalance } = require('../../../utils/economy');
const wordle = require('../../../slashCommands/minigames/wordle');

function makeInteraction({ sub = 'status', word = null } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getString: jest.fn().mockReturnValue(word),
        },
        user: { id: 'user1' },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('wordle command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        axios.get.mockResolvedValue({ data: { solution: 'CRANE' } });
    });

    test('reports failure when the word-of-the-day fetch fails', async () => {
        const interaction = makeInteraction();
        axios.get.mockRejectedValue(new Error('network error'));

        await wordle.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("Could not fetch today's Wordle") })
        );
    });

    describe('status', () => {
        test('reports no guesses made yet', async () => {
            const interaction = makeInteraction({ sub: 'status' });
            WordleGame.findOne.mockResolvedValue({ guesses: [] });

            await wordle.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("haven't made any guesses") })
            );
        });

        test('shows the board when guesses exist', async () => {
            const interaction = makeInteraction({ sub: 'status' });
            WordleGame.findOne.mockResolvedValue({ guesses: ['crate'], won: false, finished: false });

            await wordle.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('guess', () => {
        test('creates a fresh game document when none exists yet', async () => {
            const interaction = makeInteraction({ sub: 'guess', word: 'crate' });
            WordleGame.findOne.mockResolvedValue(null);
            const game = { guesses: [], won: false, finished: false, save: jest.fn().mockResolvedValue({}) };
            WordleGame.create.mockResolvedValue(game);

            await wordle.execute(interaction);

            expect(WordleGame.create).toHaveBeenCalledWith({ userId: 'user1', date: expect.any(String) });
        });

        test("rejects guessing after today's game is already won", async () => {
            const interaction = makeInteraction({ sub: 'guess', word: 'crate' });
            WordleGame.findOne.mockResolvedValue({ finished: true, won: true, guesses: ['crane'] });

            await wordle.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('already solved') })
            );
        });

        test("rejects guessing after today's game is already lost", async () => {
            const interaction = makeInteraction({ sub: 'guess', word: 'crate' });
            WordleGame.findOne.mockResolvedValue({ finished: true, won: false, guesses: [] });

            await wordle.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('game is over') })
            );
        });

        test('rejects a guess that is not exactly 5 letters', async () => {
            const interaction = makeInteraction({ sub: 'guess', word: 'ab' });
            const game = { finished: false, guesses: [], save: jest.fn() };
            WordleGame.findOne.mockResolvedValue(game);

            await wordle.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('exactly 5 English letters') })
            );
            expect(game.save).not.toHaveBeenCalled();
        });

        test('records a correct guess as a win and pays out the guess-count reward', async () => {
            const interaction = makeInteraction({ sub: 'guess', word: 'crane' });
            const game = { finished: false, guesses: [], won: false, save: jest.fn().mockResolvedValue({}) };
            WordleGame.findOne.mockResolvedValue(game);
            updateBalance.mockResolvedValue({ balance: 600 });

            await wordle.execute(interaction);

            expect(game.won).toBe(true);
            expect(game.finished).toBe(true);
            expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', 500);
            expect(game.save).toHaveBeenCalled();
        });

        test('finishes the game as a loss after the 6th wrong guess and pays the loss reward', async () => {
            const interaction = makeInteraction({ sub: 'guess', word: 'wrong' });
            const game = { finished: false, guesses: ['aaaaa', 'bbbbb', 'ccccc', 'ddddd', 'eeeee'], won: false, save: jest.fn().mockResolvedValue({}) };
            WordleGame.findOne.mockResolvedValue(game);
            updateBalance.mockResolvedValue({ balance: 525 });

            await wordle.execute(interaction);

            expect(game.finished).toBe(true);
            expect(game.won).toBe(false);
            expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', 25);
        });

        test('keeps the game open after a wrong guess with guesses remaining', async () => {
            const interaction = makeInteraction({ sub: 'guess', word: 'wrong' });
            const game = { finished: false, guesses: [], won: false, save: jest.fn().mockResolvedValue({}) };
            WordleGame.findOne.mockResolvedValue(game);

            await wordle.execute(interaction);

            expect(game.finished).toBe(false);
            expect(updateBalance).not.toHaveBeenCalled();
        });
    });
});
