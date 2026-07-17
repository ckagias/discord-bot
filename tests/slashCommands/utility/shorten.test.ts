jest.mock('axios');

const axios = require('axios');
const shorten = require('../../../slashCommands/utility/shorten');

function makeInteraction({ url = 'https://example.com' } = {}) {
    return {
        options: { getString: jest.fn().mockReturnValue(url) },
        reply: jest.fn().mockResolvedValue({}),
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('shorten command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects an unparseable URL', async () => {
        const interaction = makeInteraction({ url: 'not a url' });

        await shorten.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("doesn't look like a valid URL") })
        );
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('rejects non-http(s) protocols', async () => {
        const interaction = makeInteraction({ url: 'ftp://example.com/file' });

        await shorten.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Only `http` and `https`') })
        );
    });

    test('shortens a valid URL', async () => {
        const interaction = makeInteraction({ url: 'https://example.com/very/long/path' });
        (axios.get as jest.Mock).mockResolvedValue({ data: { shorturl: 'https://is.gd/abc123' } });

        await shorten.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('is.gd/abc123'));
    });

    test('reports failure when the shortener rejects the URL', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockResolvedValue({ data: {} });

        await shorten.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Failed to shorten') })
        );
    });

    test('reports a generic error when the request throws', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockRejectedValue(new Error('network down'));

        await expect(shorten.execute(interaction)).resolves.not.toThrow();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Something went wrong'));
    });
});
