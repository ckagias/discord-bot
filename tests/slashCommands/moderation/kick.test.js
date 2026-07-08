jest.mock('../../../utils/cases', () => ({ createCase: jest.fn() }));

const { createCase } = require('../../../utils/cases');
const kick = require('../../../slashCommands/moderation/kick');

function makeTarget(overrides = {}) {
    return {
        id: 'target1',
        user: { tag: 'Target#0001' },
        roles: { highest: { position: 1 } },
        kickable: true,
        kick: jest.fn().mockResolvedValue({}),
        ...overrides,
    };
}

function makeInteraction({ target, reason = null } = {}) {
    return {
        options: {
            getMember: jest.fn().mockReturnValue(target),
            getString: jest.fn().mockReturnValue(reason),
        },
        member: { roles: { highest: { position: 10 } } },
        guild: { id: 'g1' },
        user: { id: 'mod1' },
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('kick command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when the target is not a member of the guild', async () => {
        const interaction = makeInteraction({ target: null });

        await kick.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'That user is not in this server.' })
        );
    });

    test('rejects when the target has an equal or higher role than the moderator', async () => {
        const target = makeTarget({ roles: { highest: { position: 10 } } });
        const interaction = makeInteraction({ target });
        interaction.member.roles.highest.position = 10;

        await kick.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('equal or higher role') })
        );
        expect(target.kick).not.toHaveBeenCalled();
    });

    test('rejects when the target is not kickable', async () => {
        const target = makeTarget({ kickable: false });
        const interaction = makeInteraction({ target });

        await kick.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('cannot kick that user') })
        );
        expect(target.kick).not.toHaveBeenCalled();
    });

    test('kicks the member and creates a case on success', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, reason: 'toxicity' });
        createCase.mockResolvedValue({ caseId: 3 });

        await kick.execute(interaction);

        expect(target.kick).toHaveBeenCalledWith('toxicity');
        expect(createCase).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: 'g1', type: 'kick', userId: 'target1', moderatorId: 'mod1', reason: 'toxicity' })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Case #3') })
        );
    });

    test('replies with a generic error and does not throw when kicking fails', async () => {
        const target = makeTarget({ kick: jest.fn().mockRejectedValue(new Error('discord api down')) });
        const interaction = makeInteraction({ target, reason: 'toxicity' });

        await expect(kick.execute(interaction)).resolves.not.toThrow();

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'An error occurred while trying to kick that user.' })
        );
    });
});
