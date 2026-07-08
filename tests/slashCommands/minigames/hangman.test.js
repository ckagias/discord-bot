jest.mock('../../../models/HangmanSchema', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../../../utils/hangman', () => ({
    pickWord: jest.fn(),
    buildEmbed: jest.fn().mockReturnValue({ mock: 'embed' }),
    buildRow: jest.fn().mockReturnValue({ mock: 'row' }),
}));

const HangmanGame = require('../../../models/HangmanSchema');
const { pickWord } = require('../../../utils/hangman');
const hangman = require('../../../slashCommands/minigames/hangman');

function makeInteraction() {
    return {
        user: { id: 'user1' },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({ id: 'msg1' }),
    };
}

describe('hangman command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects starting a new game while one is already active', async () => {
        const interaction = makeInteraction();
        HangmanGame.findOne.mockResolvedValue({ finished: false });

        await hangman.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('already have an active Hangman game') })
        );
        expect(HangmanGame.create).not.toHaveBeenCalled();
    });

    test('starts a new game and persists it', async () => {
        const interaction = makeInteraction();
        HangmanGame.findOne.mockResolvedValue(null);
        pickWord.mockReturnValue('testing');

        await hangman.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: [{ mock: 'embed' }], components: [{ mock: 'row' }] })
        );
        expect(HangmanGame.create).toHaveBeenCalledWith(
            expect.objectContaining({ messageId: 'msg1', userId: 'user1', guildId: 'g1', word: 'testing' })
        );
    });
});
