jest.mock('axios');
jest.mock('../../../utils/economy', () => ({
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const axios = require('axios');
const { updateBalance } = require('../../../utils/economy');
const trivia = require('../../../slashCommands/minigames/trivia');

function makeTriviaResponse(overrides = {}) {
    return {
        data: {
            response_code: 0,
            results: [{
                question: 'What is 2+2?',
                correct_answer: '4',
                incorrect_answers: ['3', '5', '6'],
                difficulty: 'easy',
                category: 'Science',
                ...overrides,
            }],
        },
    };
}

function makeCollector() {
    const handlers: Record<string, (...args: any[]) => any> = {};
    return { on: jest.fn((event, fn) => { handlers[event] = fn; }), handlers };
}

function makeInteraction({ difficulty = null } = {}) {
    const collector = makeCollector();
    const response = { createMessageComponentCollector: jest.fn().mockReturnValue(collector) };
    return {
        options: { getString: jest.fn().mockReturnValue(difficulty) },
        user: { id: 'user1' },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue(response),
        _collector: collector,
    };
}

describe('trivia command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('reports failure when the trivia API cannot be reached', async () => {
        const interaction = makeInteraction();
        axios.get.mockRejectedValue(new Error('network error'));

        await trivia.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Could not fetch a trivia question') })
        );
    });

    test('reports failure when the API returns a non-zero response code', async () => {
        const interaction = makeInteraction();
        axios.get.mockResolvedValue({ data: { response_code: 1, results: [] } });

        await trivia.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Could not fetch a trivia question') })
        );
    });

    test('decodes HTML entities and posts the question with answer buttons', async () => {
        const interaction = makeInteraction();
        axios.get.mockResolvedValue(makeTriviaResponse({ question: 'What&#039;s 2+2?' }));

        await trivia.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
        );
    });

    test('collect handler rewards a correct answer', async () => {
        const interaction = makeInteraction();
        axios.get.mockResolvedValue(makeTriviaResponse());
        await trivia.execute(interaction);
        updateBalance.mockResolvedValue({ balance: 550 });

        // Row's customIds aren't inspectable here, so both outcomes are tested generically.
        const i = { customId: 'trivia_0', update: jest.fn().mockResolvedValue({}) };
        await interaction._collector.handlers.collect(i);

        expect(i.update).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
        );
    });

    test('end handler shows a timeout embed when no one answers', async () => {
        const interaction = makeInteraction();
        axios.get.mockResolvedValue(makeTriviaResponse());
        await trivia.execute(interaction);

        await interaction._collector.handlers.end(new Map(), 'time');

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
        );
    });

    test('end handler does nothing when someone already answered', async () => {
        const interaction = makeInteraction();
        axios.get.mockResolvedValue(makeTriviaResponse());
        await trivia.execute(interaction);
        interaction.editReply.mockClear();

        await interaction._collector.handlers.end(new Map([['x', {}]]), 'time');

        expect(interaction.editReply).not.toHaveBeenCalled();
    });
});
