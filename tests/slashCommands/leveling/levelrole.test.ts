jest.mock('../../../utils/guildConfig', () => ({
    getGuildConfig: jest.fn(),
    updateGuildConfig: jest.fn(),
}));

const { getGuildConfig, updateGuildConfig } = require('../../../utils/guildConfig');
const levelrole = require('../../../slashCommands/leveling/levelrole');

function makeInteraction({ sub, levelValue = 5, role = null, invokerPosition = 20 }: { sub: string; levelValue?: number; role?: any; invokerPosition?: number }) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getInteger: jest.fn().mockReturnValue(levelValue),
            getRole: jest.fn().mockReturnValue(role),
        },
        user: { id: 'invoker' },
        member: { roles: { highest: { position: invokerPosition } } },
        guild: { id: 'g1', ownerId: 'owner', members: { me: { roles: { highest: { position: 10 } } } } },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('levelrole command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('list', () => {
        test('reports no level roles configured', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            getGuildConfig.mockResolvedValue({});

            await levelrole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No level roles configured') })
            );
        });

        test('lists mappings sorted by level ascending', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            getGuildConfig.mockResolvedValue({ levelRoles: [{ level: 10, roleId: 'r10' }, { level: 3, roleId: 'r3' }] });

            await levelrole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('set', () => {
        test('rejects a managed role', async () => {
            const interaction = makeInteraction({ sub: 'set', role: { id: 'role1', managed: true, position: 1 } });
            getGuildConfig.mockResolvedValue({});

            await levelrole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('managed by an integration') })
            );
        });

        test('rejects the @everyone role', async () => {
            const interaction = makeInteraction({ sub: 'set', role: { id: 'g1', managed: false, position: 0 } });
            getGuildConfig.mockResolvedValue({});

            await levelrole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('@everyone') })
            );
        });

        test("rejects a role at or above the bot's highest role", async () => {
            const interaction = makeInteraction({ sub: 'set', role: { id: 'role1', managed: false, position: 10 } });
            getGuildConfig.mockResolvedValue({});

            await levelrole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('at or above my highest role') })
            );
        });

        test('replaces an existing mapping at the same level', async () => {
            const role = { id: 'role1', managed: false, position: 1, toString: () => '@Level5' };
            const interaction = makeInteraction({ sub: 'set', levelValue: 5, role });
            getGuildConfig.mockResolvedValue({ levelRoles: [{ level: 5, roleId: 'oldRole' }] });

            await levelrole.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { levelRoles: [{ level: 5, roleId: 'role1' }] });
        });
    });

    describe('remove', () => {
        test('reports when no mapping exists at that level', async () => {
            const interaction = makeInteraction({ sub: 'remove', levelValue: 9 });
            getGuildConfig.mockResolvedValue({ levelRoles: [] });

            await levelrole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No level role mapping found') })
            );
            expect(updateGuildConfig).not.toHaveBeenCalled();
        });

        test('removes the mapping at the given level', async () => {
            const interaction = makeInteraction({ sub: 'remove', levelValue: 5 });
            getGuildConfig.mockResolvedValue({ levelRoles: [{ level: 5, roleId: 'role1' }, { level: 10, roleId: 'role2' }] });

            await levelrole.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { levelRoles: [{ level: 10, roleId: 'role2' }] });
        });
    });

    test("set: rejects a role at or above the invoker's highest role", async () => {
        const interaction = makeInteraction({ sub: 'set', invokerPosition: 5, role: { id: 'role1', managed: false, position: 5 } });
        getGuildConfig.mockResolvedValue({});

        await levelrole.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('higher than or equal to your highest role') })
        );
        expect(updateGuildConfig).not.toHaveBeenCalled();
    });
});
