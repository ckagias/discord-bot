jest.mock('../../../utils/cases', () => ({ createCase: jest.fn(), logModAction: jest.fn() }));
jest.mock('../../../utils/punishments', () => ({ cancelPunishments: jest.fn() }));

const { createCase, logModAction } = require('../../../utils/cases');
const { cancelPunishments } = require('../../../utils/punishments');
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
        expect(cancelPunishments).not.toHaveBeenCalled();
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
        expect(logModAction).toHaveBeenCalledWith(
            expect.objectContaining({ guild: interaction.guild, action: 'Unban', reason: 'appealed', caseId: 6 })
        );
    });

    test('cancels the pending timed ban, so its timer cannot lift a later ban', async () => {
        const interaction = makeInteraction({ userId: 'user1' });

        await unban.execute(interaction);

        expect(cancelPunishments).toHaveBeenCalledWith('g1', 'user1', 'ban');
    });
});
