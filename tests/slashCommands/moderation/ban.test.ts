jest.mock('../../../models/PunishmentSchema', () => ({ create: jest.fn() }));
jest.mock('../../../utils/punishments', () => ({
    parseDuration: jest.fn(),
    formatDuration: jest.fn(),
    schedulePunishment: jest.fn(),
}));
jest.mock('../../../utils/cases', () => ({ createCase: jest.fn() }));

const PunishmentSchema = require('../../../models/PunishmentSchema');
const { parseDuration, formatDuration, schedulePunishment } = require('../../../utils/punishments');
const { createCase } = require('../../../utils/cases');
const ban = require('../../../slashCommands/moderation/ban');

function makeTarget(overrides: Record<string, unknown> = {}) {
    return {
        id: 'target1',
        user: { tag: 'Target#0001' },
        roles: { highest: { position: 1 } },
        bannable: true,
        send: jest.fn().mockResolvedValue({}),
        ban: jest.fn().mockResolvedValue({}),
        ...overrides,
    };
}

function makeInteraction({ target, duration = null, reason = null, deleteMessages = null }: { target: any; duration?: string | null; reason?: string | null; deleteMessages?: number | null }) {
    return {
        options: {
            getMember: jest.fn().mockReturnValue(target),
            getString: jest.fn((name) => (name === 'duration' ? duration : reason)),
            getInteger: jest.fn().mockReturnValue(deleteMessages),
        },
        member: { roles: { highest: { position: 10 } } },
        guild: { id: 'g1', name: 'Test Guild' },
        user: { id: 'mod1' },
        client: {},
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('ban command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when the target is not a member of the guild', async () => {
        const interaction = makeInteraction({ target: null });

        await ban.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'That user is not in this server.' })
        );
        expect(interaction.client).toEqual({});
    });

    test('rejects when the target has an equal or higher role than the moderator', async () => {
        const target = makeTarget({ roles: { highest: { position: 10 } } });
        const interaction = makeInteraction({ target });
        interaction.member.roles.highest.position = 10;

        await ban.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('equal or higher role') })
        );
        expect(target.ban).not.toHaveBeenCalled();
    });

    test('rejects when the target is not bannable', async () => {
        const target = makeTarget({ bannable: false });
        const interaction = makeInteraction({ target });

        await ban.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('cannot ban that user') })
        );
        expect(target.ban).not.toHaveBeenCalled();
    });

    test('rejects an invalid duration string without banning', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, duration: 'notaduration' });
        parseDuration.mockReturnValue(null);

        await ban.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Invalid duration format') })
        );
        expect(target.ban).not.toHaveBeenCalled();
    });

    test('permanently bans and creates a case when no duration is given', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, reason: 'spam' });
        createCase.mockResolvedValue({ caseId: 7 });

        await ban.execute(interaction);

        expect(target.send).toHaveBeenCalled();
        expect(target.ban).toHaveBeenCalledWith({ reason: 'spam', deleteMessageSeconds: 0 });
        expect(createCase).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: 'g1', type: 'ban', userId: 'target1', moderatorId: 'mod1', reason: 'spam' })
        );
        expect(PunishmentSchema.create).not.toHaveBeenCalled();
        expect(schedulePunishment).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Case #7') })
        );
    });

    test('temp-bans, persists a punishment, and schedules it when a duration is given', async () => {
        const target = makeTarget();
        const interaction = makeInteraction({ target, duration: '7d', reason: 'raiding' });
        parseDuration.mockReturnValue(604800000);
        formatDuration.mockReturnValue('7d 0h');
        PunishmentSchema.create.mockResolvedValue({ _id: 'p1', type: 'ban' });
        createCase.mockResolvedValue({ caseId: 8 });

        await ban.execute(interaction);

        expect(target.ban).toHaveBeenCalledWith({ reason: 'raiding', deleteMessageSeconds: 0 });
        expect(PunishmentSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'ban', guildId: 'g1', userId: 'target1' })
        );
        expect(schedulePunishment).toHaveBeenCalledWith(interaction.client, { _id: 'p1', type: 'ban' });
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Case #8') })
        );
    });

    test('replies with a generic error and does not throw when banning fails', async () => {
        const target = makeTarget({ ban: jest.fn().mockRejectedValue(new Error('discord api down')) });
        const interaction = makeInteraction({ target, reason: 'spam' });

        await expect(ban.execute(interaction)).resolves.not.toThrow();

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'An error occurred while trying to ban that user.' })
        );
    });

    test('uses editReply for the error message once the interaction has already replied', async () => {
        const target = makeTarget({ ban: jest.fn().mockRejectedValue(new Error('boom')) });
        const interaction = makeInteraction({ target, reason: 'spam' });
        interaction.replied = true;

        await ban.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'An error occurred while trying to ban that user.' })
        );
        expect(interaction.reply).not.toHaveBeenCalled();
    });
});
