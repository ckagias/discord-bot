jest.mock('../../../utils/guildConfig', () => ({ getGuildConfig: jest.fn() }));
jest.mock('../../../utils/cases', () => ({ createCase: jest.fn() }));

const { getGuildConfig } = require('../../../utils/guildConfig');
const { createCase } = require('../../../utils/cases');
const unmute = require('../../../slashCommands/moderation/unmute');

function makeTarget(overrides: Record<string, unknown> = {}) {
    return {
        id: 'target1',
        user: { tag: 'Target#0001' },
        roles: {
            cache: { has: jest.fn().mockReturnValue(true) },
            remove: jest.fn().mockResolvedValue({}),
        },
        ...overrides,
    };
}

function makeInteraction({ target, reason = null, muteRole = { id: 'role1' } }: { target: any; reason?: string | null; muteRole?: any }) {
    return {
        options: {
            getMember: jest.fn().mockReturnValue(target),
            getString: jest.fn().mockReturnValue(reason),
        },
        guild: {
            id: 'g1',
            roles: { cache: { get: jest.fn().mockReturnValue(muteRole) } },
        },
        user: { id: 'mod1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('unmute command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createCase.mockResolvedValue({ caseId: 1 });
    });

    test('rejects when the target is not a member of the guild', async () => {
        const interaction = makeInteraction({ target: null });

        await unmute.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'That user is not in this server.' })
        );
    });

    test('rejects when no mute role has been configured', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target });
        getGuildConfig.mockResolvedValue({ muteRoleId: null });

        await unmute.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('No mute role set') })
        );
    });

    test('rejects when the configured mute role no longer exists', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, muteRole: null });
        getGuildConfig.mockResolvedValue({ muteRoleId: 'role1' });

        await unmute.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('no longer exists') })
        );
    });

    test('rejects when the target does not currently have the mute role', async () => {
        const target = makeTarget({ roles: { cache: { has: jest.fn().mockReturnValue(false) }, remove: jest.fn() } });
        const interaction = makeInteraction({ target });
        getGuildConfig.mockResolvedValue({ muteRoleId: 'role1' });

        await unmute.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'That user is not muted.' })
        );
        expect(target.roles.remove).not.toHaveBeenCalled();
    });

    test('unmutes the target and creates a case on success', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, reason: 'served time' });
        getGuildConfig.mockResolvedValue({ muteRoleId: 'role1' });
        createCase.mockResolvedValue({ caseId: 11 });

        await unmute.execute(interaction);

        expect(target.roles.remove).toHaveBeenCalledWith({ id: 'role1' }, 'served time');
        expect(createCase).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: 'g1', type: 'unmute', userId: 'target1', reason: 'served time' })
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Case #11') })
        );
    });
});
