jest.mock('../../../utils/cases', () => ({ createCase: jest.fn() }));

const { createCase } = require('../../../utils/cases');
const unban = require('../../../slashCommands/moderation/unban');

function makeInteraction({ userId = 'user1', reason = null, fetchBan = jest.fn().mockResolvedValue({ user: { tag: 'Target#0001' } }) } = {}) {
    return {
        options: {
            getString: jest.fn((name) => (name === 'user_id' ? userId : reason)),
        },
        guild: {
            id: 'g1',
            bans: { fetch: fetchBan },
            members: { unban: jest.fn().mockResolvedValue({}) },
        },
        user: { id: 'mod1' },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('unban command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createCase.mockResolvedValue({ caseId: 1 });
    });

    test('rejects when the user is not currently banned', async () => {
        const interaction = makeInteraction({ fetchBan: jest.fn().mockRejectedValue(new Error('Unknown Ban')) });

        await unban.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'That user is not banned.' })
        );
        expect(interaction.guild.members.unban).not.toHaveBeenCalled();
    });

    test('unbans the user and creates a case on success', async () => {
        const interaction = makeInteraction({ userId: 'user1', reason: 'appealed' });
        createCase.mockResolvedValue({ caseId: 6 });

        await unban.execute(interaction);

        expect(interaction.guild.members.unban).toHaveBeenCalledWith('user1', 'appealed');
        expect(createCase).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: 'g1', type: 'unban', userId: 'user1', moderatorId: 'mod1', reason: 'appealed' })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Case #6') })
        );
    });
});
