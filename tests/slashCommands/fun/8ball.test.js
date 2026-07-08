jest.mock('../../../data/responses', () => ({ eightball: ['Yes.', 'No.', 'Ask again later.'] }));

const eightball = require('../../../slashCommands/fun/8ball');

function makeInteraction({ question = 'Will it work?' } = {}) {
    return {
        options: { getString: jest.fn().mockReturnValue(question) },
        user: { tag: 'User#0001' },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('8ball command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('replies with an embed containing the question and a random answer', async () => {
        const interaction = makeInteraction({ question: 'Will it work?' });

        await eightball.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
