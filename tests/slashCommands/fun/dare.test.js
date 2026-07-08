jest.mock('../../../data/responses', () => ({ dares: ['Do a dance.', 'Sing a song.'] }));

const dare = require('../../../slashCommands/fun/dare');

describe('dare command', () => {
    test('replies with a random dare from the response list', async () => {
        const interaction = { reply: jest.fn().mockResolvedValue({}) };

        await dare.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.stringMatching(/^\*\*(Do a dance\.|Sing a song\.)\*\*$/));
    });
});
