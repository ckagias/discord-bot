jest.mock('../../../models/SuggestionSchema', () => ({
    create: jest.fn(),
    find: jest.fn(),
}));
jest.mock('../../../utils/guildConfig', () => ({
    getGuildConfig: jest.fn(),
    updateGuildConfig: jest.fn(),
}));

const SuggestionSchema = require('../../../models/SuggestionSchema');
const { getGuildConfig, updateGuildConfig } = require('../../../utils/guildConfig');
const suggest = require('../../../slashCommands/utility/suggest');

function makeInteraction({ sub, hasPermission = true, text = 'add more music sources' }: { sub: string; hasPermission?: boolean; text?: string }) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getString: jest.fn().mockReturnValue(text),
            getChannel: jest.fn().mockReturnValue({ id: 'chan1', toString: () => '#suggestions' }),
            getRole: jest.fn().mockReturnValue({ id: 'role1', toString: () => '@Staff' }),
        },
        member: { permissions: { has: jest.fn().mockReturnValue(hasPermission) } },
        guild: {
            id: 'g1',
            channels: { fetch: jest.fn().mockResolvedValue({ id: 'chan1', send: jest.fn().mockResolvedValue({ id: 'msg1' }) }) },
        },
        user: { id: 'author1' },
        reply: jest.fn().mockResolvedValue({}),
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('suggest command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('submit', () => {
        test('rejects when the suggestion box is not configured', async () => {
            getGuildConfig.mockResolvedValue(null);
            const interaction = makeInteraction({ sub: 'submit' });

            await suggest.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('not configured') })
            );
            expect(SuggestionSchema.create).not.toHaveBeenCalled();
        });

        test('posts the suggestion and persists it', async () => {
            getGuildConfig.mockResolvedValue({ suggestChannelId: 'chan1' });
            const interaction = makeInteraction({ sub: 'submit', text: 'add more music sources' });
            const sentMessage = { id: 'msg1' };
            const channel = { id: 'chan1', send: jest.fn().mockResolvedValue(sentMessage) };
            (interaction.guild.channels.fetch as jest.Mock).mockResolvedValue(channel);

            SuggestionSchema.create.mockResolvedValue({
                _id: 's1',
                content: 'add more music sources',
                authorId: 'author1',
                status: 'pending',
                upvotes: [],
                downvotes: [],
                staffId: null,
                save: jest.fn().mockResolvedValue({}),
            });

            await suggest.execute(interaction);

            expect(SuggestionSchema.create).toHaveBeenCalledWith(
                expect.objectContaining({ guildId: 'g1', channelId: 'chan1', authorId: 'author1', content: 'add more music sources' })
            );
            expect(channel.send).toHaveBeenCalled();
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Jump to message') })
            );

            // Only the vote/review row is posted publicly — Approve/Deny/Implement must never
            // appear on the public message, only in the ephemeral view opened via "Review".
            const [{ components }] = (channel.send as jest.Mock).mock.calls[0];
            expect(components).toHaveLength(1);
            const buttonLabels = components[0].components.map((c: any) => c.data.label);
            expect(buttonLabels).toEqual(['Upvote', 'Downvote', 'Review']);
        });
    });

    describe('setup', () => {
        test('rejects without Manage Server permission', async () => {
            const interaction = makeInteraction({ sub: 'setup', hasPermission: false });

            await suggest.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Manage Server') })
            );
            expect(updateGuildConfig).not.toHaveBeenCalled();
        });

        test('saves the channel and approver role when permitted', async () => {
            const interaction = makeInteraction({ sub: 'setup' });

            await suggest.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { suggestChannelId: 'chan1', suggestApproverRoleId: 'role1' });
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('configured') })
            );
        });
    });

    describe('list', () => {
        test('shows a message when there are no pending suggestions', async () => {
            SuggestionSchema.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) });
            const interaction = makeInteraction({ sub: 'list' });

            await suggest.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No pending suggestions') })
            );
        });

        test('lists pending suggestions', async () => {
            const rows = [
                { guildId: 'g1', channelId: 'chan1', messageId: 'msg1', content: 'add x', upvotes: ['u1'], downvotes: [] },
            ];
            SuggestionSchema.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(rows) }) });
            const interaction = makeInteraction({ sub: 'list' });

            await suggest.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('applyStatus', () => {
        test('saves the new status and edits the live message', async () => {
            const suggestion = {
                _id: 's1',
                content: 'add x',
                authorId: 'author1',
                status: 'pending',
                upvotes: [],
                downvotes: [],
                staffId: null,
                channelId: 'chan1',
                messageId: 'msg1',
                save: jest.fn().mockResolvedValue({}),
            };
            const editMock = jest.fn().mockResolvedValue({});
            const client = {
                channels: {
                    fetch: jest.fn().mockResolvedValue({
                        messages: { fetch: jest.fn().mockResolvedValue({ edit: editMock }) },
                    }),
                },
            };

            await suggest.applyStatus(client, suggestion, 'approved', 'staff1');

            expect(suggestion.status).toBe('approved');
            expect(suggestion.staffId).toBe('staff1');
            expect(suggestion.save).toHaveBeenCalled();
            expect(editMock).toHaveBeenCalled();
        });
    });
});
