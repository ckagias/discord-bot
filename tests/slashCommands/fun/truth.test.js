jest.mock('../../../data/responses', () => ({ truths: ['What is your biggest fear?', 'What is your dream job?'] }));

const truth = require('../../../slashCommands/fun/truth');

describe('truth command', () => {
    test('replies with a random truth question from the response list', async () => {
        const interaction = { reply: jest.fn().mockResolvedValue({}) };

        await truth.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.stringMatching(/^\*\*(What is your biggest fear\?|What is your dream job\?)\*\*$/));
    });
});
