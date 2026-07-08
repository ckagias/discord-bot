const snipe = require('../../../slashCommands/utility/snipe');

function makeAuthor() {
    return { tag: 'User#0001', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png') };
}

function makeInteraction({ sub, snipeCache = new Map(), editSnipeCache = new Map() } = {}) {
    return {
        options: { getSubcommand: jest.fn().mockReturnValue(sub) },
        channelId: 'chan1',
        client: { snipeCache, editSnipeCache },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('snipe command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('delete', () => {
        test('reports no deleted messages cached', async () => {
            const interaction = makeInteraction({ sub: 'delete' });

            await snipe.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No recently deleted messages') })
            );
        });

        test('shows the cached deleted message', async () => {
            const cache = new Map([['chan1', { author: makeAuthor(), content: 'oops', deletedAt: new Date() }]]);
            const interaction = makeInteraction({ sub: 'delete', snipeCache: cache });

            await snipe.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });

        test('includes an attachment image when present', async () => {
            const cache = new Map([['chan1', { author: makeAuthor(), content: '', deletedAt: new Date(), attachmentURL: 'https://example.com/img.png' }]]);
            const interaction = makeInteraction({ sub: 'delete', snipeCache: cache });

            await expect(snipe.execute(interaction)).resolves.not.toThrow();
        });
    });

    describe('edit', () => {
        test('reports no edited messages cached', async () => {
            const interaction = makeInteraction({ sub: 'edit' });

            await snipe.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No recently edited messages') })
            );
        });

        test('shows before/after content for the cached edit', async () => {
            const cache = new Map([['chan1', { author: makeAuthor(), before: 'old', after: 'new', editedAt: new Date() }]]);
            const interaction = makeInteraction({ sub: 'edit', editSnipeCache: cache });

            await snipe.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });
});
