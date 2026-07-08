jest.mock('../../../utils/guildConfig', () => ({
    getGuildConfig: jest.fn(),
    updateGuildConfig: jest.fn(),
}));
jest.mock('../../../utils/antiRaid', () => ({
    startLockdown: jest.fn(),
    endLockdown: jest.fn(),
    ensureQuarantineOverwrites: jest.fn(),
}));
jest.mock('../../../utils/embeds', () => ({ randomColor: () => 0x000000 }));

const { getGuildConfig, updateGuildConfig } = require('../../../utils/guildConfig');
const { startLockdown, endLockdown, ensureQuarantineOverwrites } = require('../../../utils/antiRaid');
const antiraid = require('../../../slashCommands/moderation/antiraid');

function makeInteraction({ sub, role = null, threshold = null, window = null, enabled = null, member = null } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getRole: jest.fn().mockReturnValue(role),
            getInteger: jest.fn((opt) => (opt === 'threshold' ? threshold : window)),
            getBoolean: jest.fn().mockReturnValue(enabled),
            getUser: jest.fn().mockReturnValue(member),
        },
        guild: {
            id: 'g1',
            members: { me: { roles: { highest: { position: 10 } } }, fetch: jest.fn() },
            roles: { cache: { get: jest.fn() } },
            channels: { cache: { get: jest.fn() } },
        },
        user: { tag: 'Mod#0001' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('antiraid command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getGuildConfig.mockResolvedValue({});
    });

    describe('setrole', () => {
        test('rejects a bot-managed role', async () => {
            const interaction = makeInteraction({ sub: 'setrole', role: { id: 'role1', managed: true, position: 1 } });

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Bot-managed roles') })
            );
        });

        test('rejects the @everyone role', async () => {
            const interaction = makeInteraction({ sub: 'setrole', role: { id: 'g1', managed: false, position: 0 } });

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('@everyone role cannot be used') })
            );
        });

        test("rejects a role at or above the bot's highest role", async () => {
            const interaction = makeInteraction({ sub: 'setrole', role: { id: 'role1', managed: false, position: 10 } });

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("higher than or equal to my highest role") })
            );
        });

        test('saves the quarantine role and applies overwrites', async () => {
            const role = { id: 'role1', managed: false, position: 1 };
            const interaction = makeInteraction({ sub: 'setrole', role });

            await antiraid.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { antiRaidQuarantineRoleId: 'role1' });
            expect(ensureQuarantineOverwrites).toHaveBeenCalledWith(interaction.guild, role);
        });
    });

    describe('lock', () => {
        test('rejects when no quarantine role is configured', async () => {
            const interaction = makeInteraction({ sub: 'lock' });
            getGuildConfig.mockResolvedValue({});

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No quarantine role is configured') })
            );
            expect(startLockdown).not.toHaveBeenCalled();
        });

        test('rejects when a lockdown is already active', async () => {
            const interaction = makeInteraction({ sub: 'lock' });
            getGuildConfig.mockResolvedValue({ antiRaidQuarantineRoleId: 'role1', antiRaidLocked: true });

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'A lockdown is already active.' })
            );
        });

        test('starts the lockdown when configured and not already active', async () => {
            const interaction = makeInteraction({ sub: 'lock' });
            const guildData = { antiRaidQuarantineRoleId: 'role1', antiRaidLocked: false };
            getGuildConfig.mockResolvedValue(guildData);

            await antiraid.execute(interaction);

            expect(startLockdown).toHaveBeenCalledWith(interaction.guild, guildData, { auto: false, triggeredBy: interaction.user });
        });
    });

    describe('unlock', () => {
        test('rejects when there is no active lockdown', async () => {
            const interaction = makeInteraction({ sub: 'unlock' });
            getGuildConfig.mockResolvedValue({ antiRaidLocked: false });

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'There is no active lockdown.' })
            );
        });

        test('ends the lockdown and reports the released count', async () => {
            const interaction = makeInteraction({ sub: 'unlock' });
            getGuildConfig.mockResolvedValue({ antiRaidLocked: true });
            endLockdown.mockResolvedValue({ released: ['u1', 'u2'] });

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('2 quarantined members released') })
            );
        });
    });

    describe('release', () => {
        test('rejects when no quarantine role is configured', async () => {
            const interaction = makeInteraction({ sub: 'release', member: { id: 'u1' } });
            getGuildConfig.mockResolvedValue({});

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'No quarantine role is configured.' })
            );
        });

        test('rejects when the target user is not in the guild', async () => {
            const interaction = makeInteraction({ sub: 'release', member: { id: 'u1' } });
            getGuildConfig.mockResolvedValue({ antiRaidQuarantineRoleId: 'role1' });
            interaction.guild.members.fetch.mockResolvedValue(null);

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'That user is not in this server.' })
            );
        });

        test('rejects when the configured role no longer exists', async () => {
            const interaction = makeInteraction({ sub: 'release', member: { id: 'u1' } });
            getGuildConfig.mockResolvedValue({ antiRaidQuarantineRoleId: 'role1' });
            interaction.guild.members.fetch.mockResolvedValue({ roles: { cache: { has: jest.fn() }, remove: jest.fn() } });
            interaction.guild.roles.cache.get.mockReturnValue(undefined);

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'The configured quarantine role no longer exists.' })
            );
        });

        test("rejects when the member doesn't have the quarantine role", async () => {
            const interaction = makeInteraction({ sub: 'release', member: { id: 'u1' } });
            getGuildConfig.mockResolvedValue({ antiRaidQuarantineRoleId: 'role1' });
            const member = { toString: () => '@user', roles: { cache: { has: jest.fn().mockReturnValue(false) }, remove: jest.fn() } };
            interaction.guild.members.fetch.mockResolvedValue(member);
            interaction.guild.roles.cache.get.mockReturnValue({ id: 'role1' });

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("doesn't have the quarantine role") })
            );
        });

        test('releases the member from quarantine', async () => {
            const interaction = makeInteraction({ sub: 'release', member: { id: 'u1' } });
            getGuildConfig.mockResolvedValue({ antiRaidQuarantineRoleId: 'role1' });
            const remove = jest.fn().mockResolvedValue({});
            const member = { toString: () => '@user', roles: { cache: { has: jest.fn().mockReturnValue(true) }, remove } };
            interaction.guild.members.fetch.mockResolvedValue(member);
            interaction.guild.roles.cache.get.mockReturnValue({ id: 'role1' });

            await antiraid.execute(interaction);

            expect(remove).toHaveBeenCalledWith({ id: 'role1' }, expect.stringContaining('released'));
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Removed quarantine role') })
            );
        });
    });

    describe('config', () => {
        test('requires at least one option', async () => {
            const interaction = makeInteraction({ sub: 'config' });

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Provide at least one of') })
            );
            expect(updateGuildConfig).not.toHaveBeenCalled();
        });

        test('updates only the fields that were provided', async () => {
            const interaction = makeInteraction({ sub: 'config', threshold: 5, window: null, enabled: true });

            await antiraid.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { antiRaidJoinThreshold: 5, antiRaidEnabled: true });
        });
    });

    describe('status', () => {
        test('renders the current anti-raid status', async () => {
            const interaction = makeInteraction({ sub: 'status' });
            getGuildConfig.mockResolvedValue({ antiRaidLocked: false, antiRaidEnabled: true });

            await antiraid.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });
});
