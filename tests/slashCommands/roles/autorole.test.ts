jest.mock('../../../utils/guildConfig', () => ({
    updateGuildConfig: jest.fn(),
    getGuildConfig: jest.fn(),
}));

const { updateGuildConfig, getGuildConfig } = require('../../../utils/guildConfig');
const autorole = require('../../../slashCommands/roles/autorole');

function makeInteraction({ sub, role = null, invokerPosition = 20, invokerId = 'invoker' }: { sub?: string; role?: any; invokerPosition?: number; invokerId?: string } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getRole: jest.fn().mockReturnValue(role),
        },
        user: { id: invokerId },
        member: { roles: { highest: { position: invokerPosition } } },
        guild: {
            id: 'g1',
            ownerId: 'owner',
            members: { me: { roles: { highest: { position: 10 } } } },
            roles: { cache: { get: jest.fn() } },
        },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('autorole command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('set', () => {
        test('rejects a bot-managed role', async () => {
            const interaction = makeInteraction({ sub: 'set', role: { id: 'role1', managed: true, position: 1 } });

            await autorole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Bot-managed roles') })
            );
            expect(updateGuildConfig).not.toHaveBeenCalled();
        });

        test('rejects the @everyone role', async () => {
            const interaction = makeInteraction({ sub: 'set', role: { id: 'g1', managed: false, position: 0 } });

            await autorole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('@everyone role cannot be used') })
            );
        });

        test("rejects a role at or above the bot's highest role", async () => {
            const interaction = makeInteraction({ sub: 'set', role: { id: 'role1', managed: false, position: 10 } });

            await autorole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("higher than or equal to my highest role") })
            );
        });

        test('saves the autorole when all checks pass', async () => {
            const role = { id: 'role1', managed: false, position: 1, toString: () => '@Member' };
            const interaction = makeInteraction({ sub: 'set', role });

            await autorole.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { autoroleId: 'role1' });
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Autorole set to') })
            );
        });
    });

    describe('remove', () => {
        test('disables the autorole', async () => {
            const interaction = makeInteraction({ sub: 'remove' });

            await autorole.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { autoroleId: null });
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Autorole has been disabled.' })
            );
        });
    });

    describe('view', () => {
        test('reports no autorole set', async () => {
            const interaction = makeInteraction({ sub: 'view' });
            getGuildConfig.mockResolvedValue({});

            await autorole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No autorole is set') })
            );
        });

        test('reports no autorole set when the configured role no longer exists', async () => {
            const interaction = makeInteraction({ sub: 'view' });
            getGuildConfig.mockResolvedValue({ autoroleId: 'gone1' });
            interaction.guild.roles.cache.get.mockReturnValue(undefined);

            await autorole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No autorole is set') })
            );
        });

        test('shows the current autorole when configured and existing', async () => {
            const interaction = makeInteraction({ sub: 'view' });
            getGuildConfig.mockResolvedValue({ autoroleId: 'role1' });
            interaction.guild.roles.cache.get.mockReturnValue({ id: 'role1', toString: () => '@Member' });

            await autorole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Current autorole:') })
            );
        });
    });

    describe('set: invoker hierarchy', () => {
        test("rejects a role at or above the invoker's highest role", async () => {
            const interaction = makeInteraction({ sub: 'set', invokerPosition: 5, role: { id: 'role1', managed: false, position: 5 } });

            await autorole.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('higher than or equal to your highest role') })
            );
            expect(updateGuildConfig).not.toHaveBeenCalled();
        });

        test('accepts a role below the invoker', async () => {
            const interaction = makeInteraction({ sub: 'set', invokerPosition: 5, role: { id: 'role1', managed: false, position: 4 } });

            await autorole.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { autoroleId: 'role1' });
        });

        test('lets the server owner pick any role the bot can assign', async () => {
            const interaction = makeInteraction({ sub: 'set', invokerId: 'owner', invokerPosition: 0, role: { id: 'role1', managed: false, position: 9 } });

            await autorole.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { autoroleId: 'role1' });
        });
    });
});
