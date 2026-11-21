jest.mock('../../../utils/cases', () => ({ createCase: jest.fn(), logModAction: jest.fn() }));

const { createCase, logModAction } = require('../../../utils/cases');
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
        deferred: false,
        reply: jest.fn().mockResolvedValue({}),
        // Like discord.js: a deferred interaction can no longer be answered with reply().
        deferReply: jest.fn(function (this: any) { this.deferred = true; return Promise.resolve({}); }),
        editReply: jest.fn().mockResolvedValue({}),
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

    test('lets the server owner timeout a member whose role is equal or higher', async () => {
        const target = makeTarget({ roles: { highest: { position: 10 } } });
        const interaction = makeInteraction({ target, sub: 'add', duration: 3600 });
        interaction.member.roles.highest.position = 5;
        interaction.user.id = 'owner1';
        Object.assign(interaction.guild, { ownerId: 'owner1' });

        await timeout.execute(interaction);

        expect(interaction.reply).not.toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('equal or higher role') })
        );
        expect(target.timeout).toHaveBeenCalled();
    });

    test('does not let a moderator timeout the server owner, even one with a lower role', async () => {
        const target = makeTarget({ id: 'owner1' });
        const interaction = makeInteraction({ target, sub: 'add', duration: 3600 });
        Object.assign(interaction.guild, { ownerId: 'owner1' });

        await timeout.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('equal or higher role') })
        );
        expect(target.timeout).not.toHaveBeenCalled();
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
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Timed out') })
        );
        expect(logModAction).toHaveBeenCalledWith(
            expect.objectContaining({ guild: interaction.guild, action: 'Timed out', reason: 'spam', caseId: 2 })
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
        expect(interaction.editReply).toHaveBeenCalledWith(
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
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Removed timeout from') })
        );
        expect(logModAction).toHaveBeenCalledWith(
            expect.objectContaining({ guild: interaction.guild, action: 'Timeout removed', reason: 'appealed', caseId: 4 })
        );
    });

    test.each([
        ['add', false, 3600],
        ['edit', true, 600],
        ['remove', true, null],
    ])('%s: defers before the slow work and answers through editReply, so the 3-second window is not at risk', async (sub, active, duration) => {
        const order: string[] = [];
        const target = makeTarget({
            isCommunicationDisabled: jest.fn().mockReturnValue(active),
            timeout: jest.fn().mockImplementation(async () => { order.push('timeout'); }),
        });
        const interaction = makeInteraction({ target, sub, duration });
        interaction.deferReply.mockImplementation(async function (this: any) { order.push('defer'); this.deferred = true; return {}; });

        await timeout.execute(interaction);

        expect(order).toEqual(['defer', 'timeout']);
        expect(interaction.reply).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Case #1') }));
    });

    test.each([
        ['the target is not in the server', { target: null, sub: 'add' }],
        ['the target is not moderatable', { target: makeTarget({ moderatable: false }), sub: 'add' }],
        ['edit has no active timeout', { target: makeTarget(), sub: 'edit', duration: 600 }],
        ['remove has no active timeout', { target: makeTarget(), sub: 'remove' }],
    ])('does not defer when %s, so the refusal stays ephemeral', async (_name, args) => {
        const interaction = makeInteraction(args as any);

        await timeout.execute(interaction);

        expect(interaction.deferReply).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: expect.anything() }));
    });
});
