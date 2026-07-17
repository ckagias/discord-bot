jest.mock('../../../utils/cases', () => ({ createCase: jest.fn() }));

const { createCase } = require('../../../utils/cases');
const timeout = require('../../../slashCommands/moderation/timeout');

function makeTarget(overrides: Record<string, unknown> = {}) {
    return {
        id: 'target1',
        user: { tag: 'Target#0001' },
        roles: { highest: { position: 1 } },
        moderatable: true,
        isCommunicationDisabled: jest.fn().mockReturnValue(false),
        timeout: jest.fn().mockResolvedValue({}),
        ...overrides,
    };
}

function makeInteraction({ target, sub, duration = null, reason = null }: { target: any; sub: string; duration?: number | null; reason?: string | null }) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getMember: jest.fn().mockReturnValue(target),
            getString: jest.fn().mockReturnValue(reason),
            getInteger: jest.fn().mockReturnValue(duration),
        },
        member: { roles: { highest: { position: 10 } } },
        guild: { id: 'g1' },
        user: { id: 'mod1' },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('timeout command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createCase.mockResolvedValue({ caseId: 1 });
    });

    test('rejects when the target is not a member of the guild', async () => {
        const interaction = makeInteraction({ target: null, sub: 'add' });

        await timeout.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'That user is not in this server.' })
        );
    });

    test('rejects when the target has an equal or higher role than the moderator', async () => {
        const target = makeTarget({ roles: { highest: { position: 10 } } });
        const interaction = makeInteraction({ target, sub: 'add' });
        interaction.member.roles.highest.position = 10;

        await timeout.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('equal or higher role') })
        );
    });

    test('rejects when the target is not moderatable', async () => {
        const target = makeTarget({ moderatable: false });
        const interaction = makeInteraction({ target, sub: 'add' });

        await timeout.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("cannot manage that user's timeout") })
        );
    });

    test('add: times out the member and creates a case', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, sub: 'add', duration: 3600, reason: 'spam' });
        createCase.mockResolvedValue({ caseId: 2 });

        await timeout.execute(interaction);

        expect(target.timeout).toHaveBeenCalledWith(3600000, 'spam');
        expect(createCase).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: 'g1', type: 'timeout', userId: 'target1', reason: 'spam' })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Timed out') })
        );
    });

    test('edit: rejects when the target has no active timeout', async () => {
        const target = makeTarget({ isCommunicationDisabled: jest.fn().mockReturnValue(false) });
        const interaction = makeInteraction({ target, sub: 'edit', duration: 3600 });

        await timeout.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('does not have an active timeout') })
        );
        expect(target.timeout).not.toHaveBeenCalled();
    });

    test('edit: updates the timeout duration when one is already active', async () => {
        const target = makeTarget({ isCommunicationDisabled: jest.fn().mockReturnValue(true) });
        const interaction = makeInteraction({ target, sub: 'edit', duration: 600, reason: 'still spamming' });
        createCase.mockResolvedValue({ caseId: 3 });

        await timeout.execute(interaction);

        expect(target.timeout).toHaveBeenCalledWith(600000, 'still spamming');
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Updated timeout for') })
        );
    });

    test('remove: rejects when the target has no active timeout', async () => {
        const target = makeTarget({ isCommunicationDisabled: jest.fn().mockReturnValue(false) });
        const interaction = makeInteraction({ target, sub: 'remove' });

        await timeout.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'That user does not have an active timeout.' })
        );
        expect(target.timeout).not.toHaveBeenCalled();
    });

    test('remove: clears an active timeout and creates a case', async () => {
        const target = makeTarget({ isCommunicationDisabled: jest.fn().mockReturnValue(true) });
        const interaction = makeInteraction({ target, sub: 'remove', reason: 'appealed' });
        createCase.mockResolvedValue({ caseId: 4 });

        await timeout.execute(interaction);

        expect(target.timeout).toHaveBeenCalledWith(null, 'appealed');
        expect(createCase).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'timeout_remove', userId: 'target1', reason: 'appealed' })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Removed timeout from') })
        );
    });
});
