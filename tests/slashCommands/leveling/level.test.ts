jest.mock('../../../models/LevelSchema', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));
jest.mock('../../../utils/guildConfig', () => ({ getGuildConfig: jest.fn() }));

const LevelSchema = require('../../../models/LevelSchema');
const { getGuildConfig } = require('../../../utils/guildConfig');
const level = require('../../../slashCommands/leveling/level');

function makeInteraction({ sub, user = null, levelValue = 5, xp = null, hasPermission = true }: { sub: string; user?: any; levelValue?: number; xp?: number | null; hasPermission?: boolean }) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getUser: jest.fn().mockReturnValue(user),
            getInteger: jest.fn((opt) => (opt === 'level' ? levelValue : xp)),
        },
        member: { permissions: { has: jest.fn().mockReturnValue(hasPermission) } },
        user: { id: 'self1', username: 'Self', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png') },
        guild: {
            id: 'g1',
            name: 'Test Guild',
            iconURL: jest.fn().mockReturnValue('https://example.com/icon.png'),
            members: { fetch: jest.fn().mockResolvedValue(null) },
            roles: { cache: { get: jest.fn() } },
        },
        reply: jest.fn().mockResolvedValue({}),
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('level command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('check', () => {
        test('rejects when leveling is not enabled', async () => {
            const interaction = makeInteraction({ sub: 'check' });
            getGuildConfig.mockResolvedValue({ levelingEnabled: false });

            await level.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Leveling is not enabled on this server.' })
            );
        });

        test('reports no XP earned when there is no record', async () => {
            const interaction = makeInteraction({ sub: 'check' });
            getGuildConfig.mockResolvedValue({ levelingEnabled: true });
            LevelSchema.findOne.mockResolvedValue(null);

            await level.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("hasn't earned any XP") })
            );
        });

        test('reports no XP earned when the record is all zeroes', async () => {
            const interaction = makeInteraction({ sub: 'check' });
            getGuildConfig.mockResolvedValue({ levelingEnabled: true });
            LevelSchema.findOne.mockResolvedValue({ xp: 0, level: 0 });

            await level.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("hasn't earned any XP") })
            );
        });

        test('shows level and progress embed for the invoking user by default', async () => {
            const interaction = makeInteraction({ sub: 'check', user: null });
            getGuildConfig.mockResolvedValue({ levelingEnabled: true });
            LevelSchema.findOne.mockResolvedValue({ level: 2, xp: 50 });

            await level.execute(interaction);

            expect(LevelSchema.findOne).toHaveBeenCalledWith({ userId: 'self1', guildId: 'g1' });
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('set', () => {
        test('rejects without Manage Server permission', async () => {
            const interaction = makeInteraction({ sub: 'set', hasPermission: false });

            await level.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Manage Server permission') })
            );
            expect(LevelSchema.findOneAndUpdate).not.toHaveBeenCalled();
        });

        test('rejects when leveling is not enabled', async () => {
            const interaction = makeInteraction({ sub: 'set', user: { id: 'target1', username: 'Target' } });
            getGuildConfig.mockResolvedValue({ levelingEnabled: false });

            await level.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Leveling is not enabled on this server.' })
            );
        });

        test('rejects XP at or above the threshold for the next level', async () => {
            const interaction = makeInteraction({ sub: 'set', user: { id: 'target1', username: 'Target' }, levelValue: 2, xp: 900 });
            getGuildConfig.mockResolvedValue({ levelingEnabled: true });

            await level.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('must be less than') })
            );
            expect(LevelSchema.findOneAndUpdate).not.toHaveBeenCalled();
        });

        test('sets the level and xp, and grants backfilled level roles', async () => {
            const target = { id: 'target1', username: 'Target' };
            const interaction = makeInteraction({ sub: 'set', user: target, levelValue: 5, xp: 100 });
            const guildData = {
                levelingEnabled: true,
                levelRoles: [{ level: 3, roleId: 'role3' }, { level: 10, roleId: 'role10' }],
            };
            getGuildConfig.mockResolvedValue(guildData);

            const add = jest.fn().mockResolvedValue({});
            const member = { roles: { cache: { has: jest.fn().mockReturnValue(false) }, add } };
            (interaction.guild.members.fetch as jest.Mock).mockResolvedValue(member);
            (interaction.guild.roles.cache.get as jest.Mock).mockImplementation((id: string) => ({ id }));

            await level.execute(interaction);

            expect(LevelSchema.findOneAndUpdate).toHaveBeenCalledWith(
                { userId: 'target1', guildId: 'g1' },
                { $set: { level: 5, xp: 100 } },
                { upsert: true }
            );
            expect(add).toHaveBeenCalledTimes(1);
            expect(add).toHaveBeenCalledWith({ id: 'role3' }, expect.stringContaining('Level set to 5'));
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('100 XP') })
            );
        });

        test('does not re-grant a level role the member already has', async () => {
            const target = { id: 'target1', username: 'Target' };
            const interaction = makeInteraction({ sub: 'set', user: target, levelValue: 5, xp: 0 });
            getGuildConfig.mockResolvedValue({ levelingEnabled: true, levelRoles: [{ level: 3, roleId: 'role3' }] });

            const add = jest.fn();
            const member = { roles: { cache: { has: jest.fn().mockReturnValue(true) }, add } };
            (interaction.guild.members.fetch as jest.Mock).mockResolvedValue(member);
            (interaction.guild.roles.cache.get as jest.Mock).mockReturnValue({ id: 'role3' });

            await level.execute(interaction);

            expect(add).not.toHaveBeenCalled();
        });

        test('defaults xp to 0 and notes the reset when no xp option is given', async () => {
            const target = { id: 'target1', username: 'Target' };
            const interaction = makeInteraction({ sub: 'set', user: target, levelValue: 1, xp: null });
            getGuildConfig.mockResolvedValue({ levelingEnabled: true });

            await level.execute(interaction);

            expect(LevelSchema.findOneAndUpdate).toHaveBeenCalledWith(
                { userId: 'target1', guildId: 'g1' },
                { $set: { level: 1, xp: 0 } },
                { upsert: true }
            );
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('XP reset to 0') })
            );
        });
    });
});
