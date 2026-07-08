jest.mock('../../../utils/validate', () => ({ isValidUrl: jest.fn() }));
jest.mock('../../../utils/embeds', () => ({ parseHexColor: jest.fn() }));

const { isValidUrl } = require('../../../utils/validate');
const { parseHexColor } = require('../../../utils/embeds');
const embed = require('../../../slashCommands/utility/embed');

function makeInteraction({ sub, channel = null, messageId = 'msg1' } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getChannel: jest.fn().mockReturnValue(channel),
            getString: jest.fn().mockReturnValue(messageId),
        },
        channel: { id: 'chan1', isTextBased: () => true, messages: { fetch: jest.fn() } },
        channelId: 'chan1',
        guild: { members: { me: {} } },
        client: { user: { id: 'bot1' } },
        showModal: jest.fn().mockResolvedValue({}),
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('embed command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        test('rejects a non-text-based channel', async () => {
            const interaction = makeInteraction({ sub: 'create', channel: { isTextBased: () => false } });

            await embed.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('not a text channel') })
            );
        });

        test('rejects when the bot lacks Send Messages permission in the target channel', async () => {
            const channel = { id: 'c2', isTextBased: () => true, permissionsFor: jest.fn().mockReturnValue({ has: jest.fn().mockReturnValue(false) }), toString: () => '#c2' };
            const interaction = makeInteraction({ sub: 'create', channel });

            await embed.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("don't have permission") })
            );
        });

        test('shows the embed builder modal when checks pass', async () => {
            const channel = { id: 'c2', isTextBased: () => true, permissionsFor: jest.fn().mockReturnValue({ has: jest.fn().mockReturnValue(true) }) };
            const interaction = makeInteraction({ sub: 'create', channel });

            await embed.execute(interaction);

            expect(interaction.showModal).toHaveBeenCalled();
        });

        test('defaults to the current channel when no channel option is given', async () => {
            const interaction = makeInteraction({ sub: 'create', channel: null });
            interaction.channel.permissionsFor = jest.fn().mockReturnValue({ has: jest.fn().mockReturnValue(true) });

            await embed.execute(interaction);

            expect(interaction.showModal).toHaveBeenCalled();
        });
    });

    describe('edit', () => {
        test('rejects when the message cannot be found', async () => {
            const interaction = makeInteraction({ sub: 'edit' });
            interaction.channel.messages.fetch.mockResolvedValue(null);

            await embed.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Could not find that message') })
            );
        });

        test('rejects a message not posted by the bot', async () => {
            const interaction = makeInteraction({ sub: 'edit' });
            interaction.channel.messages.fetch.mockResolvedValue({ author: { id: 'someoneElse' }, embeds: [] });

            await embed.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('I can only edit messages') })
            );
        });

        test('rejects a bot message with no embed', async () => {
            const interaction = makeInteraction({ sub: 'edit' });
            interaction.channel.messages.fetch.mockResolvedValue({ author: { id: 'bot1' }, embeds: [] });

            await embed.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('no embed to edit') })
            );
        });

        test('shows the pre-filled edit modal for a valid target message', async () => {
            const interaction = makeInteraction({ sub: 'edit' });
            interaction.channel.messages.fetch.mockResolvedValue({
                author: { id: 'bot1' },
                embeds: [{ title: 'Old title', description: 'Old desc' }],
            });

            await embed.execute(interaction);

            expect(interaction.showModal).toHaveBeenCalled();
        });
    });

    describe('help', () => {
        test('shows the formatting guide embed ephemerally', async () => {
            const interaction = makeInteraction({ sub: 'help' });

            await embed.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array), flags: expect.any(Number) })
            );
        });
    });
});

describe('embed helper exports', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('parseMainFields', () => {
        function makeModalInteraction(values) {
            return { fields: { getTextInputValue: jest.fn((id) => values[id] ?? '') } };
        }

        test('propagates a hex color parse error', () => {
            parseHexColor.mockReturnValue({ error: 'Invalid color' });
            const interaction = makeModalInteraction({ embed_color: 'notacolor' });

            const result = embed.parseMainFields(interaction);

            expect(result.error).toBe('Invalid color');
        });

        test('rejects an invalid image URL', () => {
            parseHexColor.mockReturnValue({ color: 0x5865f2 });
            isValidUrl.mockReturnValue(false);
            const interaction = makeModalInteraction({ embed_image: 'not-a-url' });

            const result = embed.parseMainFields(interaction);

            expect(result.error).toBe('Invalid image URL.');
        });

        test('parses valid fields successfully', () => {
            parseHexColor.mockReturnValue({ color: 0x5865f2 });
            isValidUrl.mockReturnValue(true);
            const interaction = makeModalInteraction({
                embed_title: 'Title', embed_description: 'Desc', embed_footer: 'Footer', embed_image: 'https://example.com/img.png',
            });

            const result = embed.parseMainFields(interaction);

            expect(result).toEqual({ title: 'Title', description: 'Desc', color: 0x5865f2, footerText: 'Footer', imageUrl: 'https://example.com/img.png' });
        });
    });

    describe('parseFieldLines', () => {
        function makeModalInteraction(values) {
            return { fields: { getTextInputValue: jest.fn((id) => values[id] ?? '') } };
        }

        test('skips blank field lines', () => {
            const interaction = makeModalInteraction({});

            expect(embed.parseFieldLines(interaction)).toEqual([]);
        });

        test('skips malformed lines missing a value', () => {
            const interaction = makeModalInteraction({ embed_field_1: 'JustAName' });

            expect(embed.parseFieldLines(interaction)).toEqual([]);
        });

        test('parses a valid inline field line', () => {
            const interaction = makeModalInteraction({ embed_field_1: 'Name | Value | yes' });

            expect(embed.parseFieldLines(interaction)).toEqual([{ name: 'Name', value: 'Value', inline: true }]);
        });

        test('defaults inline to false when the third segment is missing or not "yes"', () => {
            const interaction = makeModalInteraction({ embed_field_1: 'Name | Value' });

            expect(embed.parseFieldLines(interaction)).toEqual([{ name: 'Name', value: 'Value', inline: false }]);
        });
    });

    describe('buildEmbed', () => {
        test('only sets fields that are present', () => {
            const result = embed.buildEmbed({ title: null, description: 'desc', color: 0x000000, footerText: null, imageUrl: null });

            expect(result.data.title).toBeUndefined();
            expect(result.data.description).toBe('desc');
        });
    });
});
