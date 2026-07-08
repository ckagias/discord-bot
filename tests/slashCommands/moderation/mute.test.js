jest.mock('../../../utils/guildConfig', () => ({ getGuildConfig: jest.fn() }));
jest.mock('../../../models/PunishmentSchema', () => ({ create: jest.fn() }));
jest.mock('../../../utils/punishments', () => ({
    parseDuration: jest.fn(),
    formatDuration: jest.fn(),
    schedulePunishment: jest.fn(),
}));
jest.mock('../../../utils/cases', () => ({ createCase: jest.fn() }));

const { getGuildConfig } = require('../../../utils/guildConfig');
const PunishmentSchema = require('../../../models/PunishmentSchema');
const { parseDuration, formatDuration, schedulePunishment } = require('../../../utils/punishments');
const { createCase } = require('../../../utils/cases');
const mute = require('../../../slashCommands/moderation/mute');

function makeCollection(items = []) {
    const map = new Map(items.map((item, i) => [item.id ?? i, item]));
    map.filter = (fn) => makeCollection([...map.values()].filter(fn));
    return map;
}

function makeTarget(overrides = {}) {
    return {
        id: 'target1',
        user: { tag: 'Target#0001' },
        roles: {
            highest: { position: 1 },
            cache: { has: jest.fn().mockReturnValue(false) },
            add: jest.fn().mockResolvedValue({}),
        },
        ...overrides,
    };
}

function makeInteraction({ target, duration = null, reason = null, muteRole = { id: 'role1' } } = {}) {
    return {
        options: {
            getMember: jest.fn().mockReturnValue(target),
            getString: jest.fn((name) => (name === 'duration' ? duration : reason)),
        },
        member: { roles: { highest: { position: 10 } } },
        guild: {
            id: 'g1',
            name: 'Test Guild',
            roles: { cache: { get: jest.fn().mockReturnValue(muteRole) } },
            channels: { cache: makeCollection([]) },
        },
        user: { id: 'mod1' },
        client: {},
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue({}),
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('mute command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when the target is not a member of the guild', async () => {
        const interaction = makeInteraction({ target: null });

        await mute.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'That user is not in this server.' })
        );
    });

    test('rejects when the target has an equal or higher role than the moderator', async () => {
        const target = makeTarget({ roles: { highest: { position: 10 }, cache: { has: jest.fn() }, add: jest.fn() } });
        const interaction = makeInteraction({ target });
        interaction.member.roles.highest.position = 10;

        await mute.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('equal or higher role') })
        );
    });

    test('rejects when no mute role has been configured', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target });
        getGuildConfig.mockResolvedValue({ muteRoleId: null });

        await mute.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('No mute role set') })
        );
    });

    test('rejects when the configured mute role no longer exists', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, muteRole: null });
        getGuildConfig.mockResolvedValueOnce({ muteRoleId: 'role1' });

        await mute.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('no longer exists') })
        );
    });

    test('rejects when the target already has the mute role', async () => {
        const target = makeTarget({
            roles: { highest: { position: 1 }, cache: { has: jest.fn().mockReturnValue(true) }, add: jest.fn() },
        });
        const interaction = makeInteraction({ target });
        getGuildConfig.mockResolvedValue({ muteRoleId: 'role1' });

        await mute.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'That user is already muted.' })
        );
        expect(target.roles.add).not.toHaveBeenCalled();
    });

    test('rejects an invalid duration string without muting', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, duration: 'bogus' });
        getGuildConfig.mockResolvedValue({ muteRoleId: 'role1' });
        parseDuration.mockReturnValue(null);

        await mute.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Invalid duration format') })
        );
        expect(target.roles.add).not.toHaveBeenCalled();
    });

    test('permanently mutes and creates a case when no duration is given', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, reason: 'spam' });
        getGuildConfig.mockResolvedValue({ muteRoleId: 'role1' });
        createCase.mockResolvedValue({ caseId: 4 });

        await mute.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(target.roles.add).toHaveBeenCalledWith({ id: 'role1' }, 'spam');
        expect(createCase).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: 'g1', type: 'mute', userId: 'target1', reason: 'spam' })
        );
        expect(PunishmentSchema.create).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Case #4') })
        );
    });

    test('temp-mutes, persists a punishment, and schedules it when a duration is given', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, duration: '30m', reason: 'spam' });
        getGuildConfig.mockResolvedValue({ muteRoleId: 'role1' });
        parseDuration.mockReturnValue(1800000);
        formatDuration.mockReturnValue('30m');
        PunishmentSchema.create.mockResolvedValue({ _id: 'p1', type: 'mute' });
        createCase.mockResolvedValue({ caseId: 5 });

        await mute.execute(interaction);

        expect(PunishmentSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'mute', guildId: 'g1', userId: 'target1', muteRoleId: 'role1' })
        );
        expect(schedulePunishment).toHaveBeenCalledWith(interaction.client, { _id: 'p1', type: 'mute' });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Case #5') })
        );
    });
});
