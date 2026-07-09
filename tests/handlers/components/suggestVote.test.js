jest.mock('../../../models/SuggestionSchema', () => ({
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../../utils/guildConfig', () => ({
    getGuildConfig: jest.fn(),
}));
jest.mock('../../../slashCommands/utility/suggest', () => ({
    suggestionEmbed: jest.fn(),
    voteRow: jest.fn(),
    staffRow: jest.fn(),
    applyStatus: jest.fn(),
    capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
}));

const SuggestionSchema = require('../../../models/SuggestionSchema');
const { getGuildConfig } = require('../../../utils/guildConfig');
const { applyStatus } = require('../../../slashCommands/utility/suggest');
const handlers = require('../../../handlers/components/suggestVote');

function handler(prefix) {
    return handlers.find(h => h.prefix === prefix).execute;
}

function makeInteraction({ customId, upvotes = [], downvotes = [] } = {}) {
    return {
        customId,
        user: { id: 'user1' },
        member: { permissions: { has: jest.fn().mockReturnValue(false) }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } },
        guild: { id: 'g1' },
        client: {},
        message: {
            embeds: [{ title: 'Suggestion', fields: [{ name: 'Submitted by' }, { name: 'Status' }, { name: '👍', value: `${upvotes.length}` }, { name: '👎', value: `${downvotes.length}` }] }],
            edit: jest.fn().mockResolvedValue({}),
        },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('suggestVote handlers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('upvote/downvote', () => {
        test('rejects voting on a resolved suggestion', async () => {
            SuggestionSchema.findById.mockResolvedValue({ status: 'approved' });
            const interaction = makeInteraction({ customId: 'suggest_up:s1' });

            await handler('suggest_up:')(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('no longer accepting votes') })
            );
            expect(SuggestionSchema.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        test('adds an upvote and removes any existing downvote', async () => {
            SuggestionSchema.findById.mockResolvedValue({ status: 'pending', upvotes: [], downvotes: ['user1'] });
            SuggestionSchema.findByIdAndUpdate.mockResolvedValue({ upvotes: ['user1'], downvotes: [] });
            const interaction = makeInteraction({ customId: 'suggest_up:s1' });

            await handler('suggest_up:')(interaction);

            expect(SuggestionSchema.findByIdAndUpdate).toHaveBeenCalledWith(
                's1',
                { $addToSet: { upvotes: 'user1' }, $pull: { downvotes: 'user1' } },
                { new: true }
            );
            expect(interaction.message.edit).toHaveBeenCalled();
        });

        test('removes an existing upvote (toggle off)', async () => {
            SuggestionSchema.findById.mockResolvedValue({ status: 'pending', upvotes: ['user1'], downvotes: [] });
            SuggestionSchema.findByIdAndUpdate.mockResolvedValue({ upvotes: [], downvotes: [] });
            const interaction = makeInteraction({ customId: 'suggest_up:s1' });

            await handler('suggest_up:')(interaction);

            expect(SuggestionSchema.findByIdAndUpdate).toHaveBeenCalledWith(
                's1',
                { $pull: { upvotes: 'user1' } },
                { new: true }
            );
        });
    });

    describe('review', () => {
        test('rejects without the approver role or Manage Server', async () => {
            getGuildConfig.mockResolvedValue({ suggestApproverRoleId: 'role1' });
            const interaction = makeInteraction({ customId: 'suggest_review:s1' });

            await handler('suggest_review:')(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('do not have permission') })
            );
        });

        test('replies with the staff action buttons when the actor can review', async () => {
            getGuildConfig.mockResolvedValue({ suggestApproverRoleId: 'role1' });
            const interaction = makeInteraction({ customId: 'suggest_review:s1' });
            interaction.member.roles.cache.has.mockReturnValue(true);
            SuggestionSchema.findById.mockResolvedValue({ status: 'pending' });

            await handler('suggest_review:')(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ components: expect.any(Array), flags: expect.anything() })
            );
        });

        test('rejects reviewing an already-resolved suggestion', async () => {
            getGuildConfig.mockResolvedValue({ suggestApproverRoleId: 'role1' });
            const interaction = makeInteraction({ customId: 'suggest_review:s1' });
            interaction.member.roles.cache.has.mockReturnValue(true);
            SuggestionSchema.findById.mockResolvedValue({ status: 'approved' });

            await handler('suggest_review:')(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('already been reviewed') })
            );
        });
    });

    describe('staff actions', () => {
        test('rejects without the approver role or Manage Server', async () => {
            getGuildConfig.mockResolvedValue({ suggestApproverRoleId: 'role1' });
            const interaction = makeInteraction({ customId: 'suggest_approve:s1' });

            await handler('suggest_approve:')(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('do not have permission') })
            );
            expect(applyStatus).not.toHaveBeenCalled();
        });

        test('applies the status when the actor has the approver role', async () => {
            getGuildConfig.mockResolvedValue({ suggestApproverRoleId: 'role1' });
            const interaction = makeInteraction({ customId: 'suggest_approve:s1' });
            interaction.member.roles.cache.has.mockReturnValue(true);
            SuggestionSchema.findById.mockResolvedValue({ status: 'pending' });

            await handler('suggest_approve:')(interaction);

            expect(applyStatus).toHaveBeenCalledWith(interaction.client, expect.objectContaining({ status: 'pending' }), 'approved', 'user1');
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Approved') })
            );
        });

        test('rejects reviewing an already-resolved suggestion', async () => {
            getGuildConfig.mockResolvedValue({ suggestApproverRoleId: 'role1' });
            const interaction = makeInteraction({ customId: 'suggest_deny:s1' });
            interaction.member.roles.cache.has.mockReturnValue(true);
            SuggestionSchema.findById.mockResolvedValue({ status: 'denied' });

            await handler('suggest_deny:')(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('already been reviewed') })
            );
            expect(applyStatus).not.toHaveBeenCalled();
        });
    });
});
