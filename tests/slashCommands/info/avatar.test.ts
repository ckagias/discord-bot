const avatar = require('../../../slashCommands/info/avatar');

function makeUser(overrides: Record<string, unknown> = {}) {
    return {
        id: 'user1',
        tag: 'User#0001',
        displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png'),
        ...overrides,
    };
}

function makeInteraction({ sub, user = null, member = undefined }: { sub: string; user?: any; member?: any }) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getUser: jest.fn().mockReturnValue(user),
        },
        user: makeUser({ id: 'self1' }),
        guild: { members: { cache: { get: jest.fn().mockReturnValue(member) } } },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('avatar command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('global', () => {
        test('defaults to the invoking user when no user is given', async () => {
            const interaction = makeInteraction({ sub: 'global', user: null });

            await avatar.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });

        test('shows the specified user avatar', async () => {
            const other = makeUser({ id: 'other1' });
            const interaction = makeInteraction({ sub: 'global', user: other });

            await avatar.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('server', () => {
        test('rejects when the user is not a member of the guild', async () => {
            const target = makeUser({ id: 'target1' });
            const interaction = makeInteraction({ sub: 'server', user: target, member: undefined });

            await avatar.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'That user is not in this server.' })
            );
        });

        test('rejects when the member has no server-specific avatar', async () => {
            const target = makeUser({ id: 'target1' });
            const member = { avatarURL: jest.fn().mockReturnValue(null) };
            const interaction = makeInteraction({ sub: 'server', user: target, member });

            await avatar.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('no server-specific avatar') })
            );
        });

        test('shows the server avatar when present', async () => {
            const target = makeUser({ id: 'target1' });
            const member = { avatarURL: jest.fn().mockReturnValue('https://example.com/server-avatar.png') };
            const interaction = makeInteraction({ sub: 'server', user: target, member });

            await avatar.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });
});
