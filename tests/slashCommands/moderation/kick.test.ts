jest.mock('../../../utils/cases', () => ({ createCase: jest.fn(), logModAction: jest.fn() }));

const { createCase, logModAction } = require('../../../utils/cases');
const kick = require('../../../slashCommands/moderation/kick');

function makeTarget(overrides: Record<string, unknown> = {}) {
    return {
        id: 'target1',
        user: { tag: 'Target#0001' },
        roles: { highest: { position: 1 } },
        kickable: true,
        kick: jest.fn().mockResolvedValue({}),
        ...overrides,
    };
}

function makeInteraction({ target, reason = null }: { target: any; reason?: string | null }) {
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
        // Like discord.js: a deferred interaction can no longer be answered with reply().
        deferReply: jest.fn(function (this: any) { this.deferred = true; return Promise.resolve({}); }),
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

    test('lets the server owner kick a member whose role is equal or higher', async () => {
        const target = makeTarget({ roles: { highest: { position: 10 } } });
        const interaction = makeInteraction({ target });
        interaction.member.roles.highest.position = 5;
        interaction.user.id = 'owner1';
        Object.assign(interaction.guild, { ownerId: 'owner1' });

        await kick.execute(interaction);

        expect(interaction.reply).not.toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('equal or higher role') })
        );
        expect(target.kick).toHaveBeenCalled();
    });

    test('does not let a moderator kick the server owner, even one with a lower role', async () => {
        const target = makeTarget({ id: 'owner1' });
        const interaction = makeInteraction({ target });
        Object.assign(interaction.guild, { ownerId: 'owner1' });

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
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Case #3') })
        );
        expect(logModAction).toHaveBeenCalledWith(
            expect.objectContaining({ guild: interaction.guild, action: 'Kick', reason: 'toxicity', caseId: 3 })
        );
    });

    test('defers before the slow work and answers through editReply, so the 3-second window is not at risk', async () => {
        const order: string[] = [];
        const target = makeTarget({ kick: jest.fn().mockImplementation(async () => { order.push('kick'); }) });
        const interaction = makeInteraction({ target });
        interaction.deferReply.mockImplementation(async function (this: any) { order.push('defer'); this.deferred = true; return {}; });
        createCase.mockResolvedValue({ caseId: 4 });

        await kick.execute(interaction);

        expect(order).toEqual(['defer', 'kick']);
        expect(interaction.reply).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Case #4') }));
    });

    test('does not defer when a check rejects the request, so the refusal stays ephemeral', async () => {
        const interaction = makeInteraction({ target: null });

        await kick.execute(interaction);

        expect(interaction.deferReply).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: expect.anything() }));
    });

    test('replies with a generic error and does not throw when kicking fails', async () => {
        const target = makeTarget({ kick: jest.fn().mockRejectedValue(new Error('discord api down')) });
        const interaction = makeInteraction({ target, reason: 'toxicity' });

        await expect(kick.execute(interaction)).resolves.not.toThrow();

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'An error occurred while trying to kick that user.' })
        );
    });
});
