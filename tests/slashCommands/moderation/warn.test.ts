jest.mock('../../../models/WarnSchema', () => ({
    create: jest.fn(),
    countDocuments: jest.fn(),
}));
jest.mock('../../../utils/guildConfig', () => ({ getGuildConfig: jest.fn() }));
jest.mock('../../../utils/warnThresholds', () => ({ checkWarnThresholds: jest.fn() }));
jest.mock('../../../utils/cases', () => ({ createCase: jest.fn() }));

const WarnSchema = require('../../../models/WarnSchema');
const { getGuildConfig } = require('../../../utils/guildConfig');
const { checkWarnThresholds } = require('../../../utils/warnThresholds');
const { createCase } = require('../../../utils/cases');
const warn = require('../../../slashCommands/moderation/warn');

function makeTarget(overrides: Record<string, unknown> = {}) {
    return {
        id: 'target1',
        user: { tag: 'Target#0001', send: jest.fn().mockResolvedValue({}) },
        roles: { highest: { position: 1 } },
        ...overrides,
    };
}

function makeInteraction({ target, reason = null, modId = 'mod1', ownerId = 'owner1' }: { target: any; reason?: string | null; modId?: string; ownerId?: string }) {
    return {
        options: {
            getMember: jest.fn().mockReturnValue(target),
            getString: jest.fn().mockReturnValue(reason),
        },
        member: { roles: { highest: { position: 10 } } },
        guild: { id: 'g1', name: 'Test Guild', ownerId },
        user: { id: modId },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('warn command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        WarnSchema.create.mockResolvedValue({});
        WarnSchema.countDocuments.mockResolvedValue(1);
        getGuildConfig.mockResolvedValue({});
        createCase.mockResolvedValue({ caseId: 1 });
    });

    test('rejects when the target is not a member of the guild', async () => {
        const interaction = makeInteraction({ target: null });

        await warn.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'That user is not in this server.' })
        );
        expect(WarnSchema.create).not.toHaveBeenCalled();
    });

    test('rejects self-warning', async () => {
        const target = makeTarget({ id: 'mod1' });
        const interaction = makeInteraction({ target, modId: 'mod1' });

        await warn.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You cannot warn yourself.' })
        );
        expect(WarnSchema.create).not.toHaveBeenCalled();
    });

    test('rejects warning the server owner', async () => {
        const target = makeTarget({ id: 'owner1' });
        const interaction = makeInteraction({ target, ownerId: 'owner1' });

        await warn.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You cannot warn the server owner.' })
        );
        expect(WarnSchema.create).not.toHaveBeenCalled();
    });

    test('rejects when the target has an equal or higher role than the moderator', async () => {
        const target = makeTarget({ roles: { highest: { position: 10 } } });
        const interaction = makeInteraction({ target });
        interaction.member.roles.highest.position = 10;

        await warn.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('equal or higher role') })
        );
        expect(WarnSchema.create).not.toHaveBeenCalled();
    });

    test('records the warning, dms the user, checks thresholds, and creates a case', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, reason: 'spam' });
        WarnSchema.countDocuments.mockResolvedValue(3);
        const guildData = { warnThresholds: [] };
        getGuildConfig.mockResolvedValue(guildData);
        createCase.mockResolvedValue({ caseId: 9 });

        await warn.execute(interaction);

        expect(WarnSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: 'g1', userId: 'target1', moderatorId: 'mod1', reason: 'spam' })
        );
        expect(target.user.send).toHaveBeenCalledWith(expect.stringContaining('Total warnings:** 3'));
        expect(checkWarnThresholds).toHaveBeenCalledWith(interaction.guild, target, 3, guildData);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Case #9') })
        );
    });

    test('still replies successfully when the DM to the user fails', async () => {
        const target = makeTarget();
        target.user.send.mockRejectedValue(new Error('DMs closed'));
        const interaction = makeInteraction({ target, reason: 'spam' });

        await expect(warn.execute(interaction)).resolves.not.toThrow();

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Warned') })
        );
    });
});
