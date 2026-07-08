jest.mock('../../../models/ReactionRoleSchema', () => ({
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
}));

const ReactionRoleSchema = require('../../../models/ReactionRoleSchema');
const reactionrole = require('../../../slashCommands/roles/reactionrole');

function makeInteraction({ sub, messageId = 'msg1', emoji = '⭐', role = null } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getString: jest.fn((opt) => (opt === 'message_id' ? messageId : emoji)),
            getRole: jest.fn().mockReturnValue(role),
        },
        guild: {
            id: 'g1',
            members: { me: { roles: { highest: { comparePositionTo: jest.fn().mockReturnValue(1) } } } },
        },
        channel: { messages: { fetch: jest.fn().mockResolvedValue({ react: jest.fn().mockResolvedValue({}) }) } },
        channelId: 'chan1',
        reply: jest.fn().mockResolvedValue({}),
        showModal: jest.fn().mockResolvedValue({}),
    };
}

describe('reactionrole command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('add', () => {
        test('rejects a role that cannot be assigned (managed or @everyone)', async () => {
            const interaction = makeInteraction({ sub: 'add', role: { id: 'g1', managed: false, name: 'everyone' } });

            await reactionrole.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'That role cannot be assigned.' })
            );
            expect(ReactionRoleSchema.create).not.toHaveBeenCalled();
        });

        test("rejects when the bot's highest role is below the target role", async () => {
            const interaction = makeInteraction({ sub: 'add', role: { id: 'role1', managed: false, name: 'VIP' } });
            interaction.guild.members.me.roles.highest.comparePositionTo.mockReturnValue(-1);

            await reactionrole.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("can't assign it") })
            );
        });

        test('rejects when the emoji is already bound on that message', async () => {
            const interaction = makeInteraction({ sub: 'add', role: { id: 'role1', managed: false, name: 'VIP' } });
            ReactionRoleSchema.findOne.mockResolvedValue({ emoji: '⭐' });

            await reactionrole.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('already bound') })
            );
            expect(ReactionRoleSchema.create).not.toHaveBeenCalled();
        });

        test('creates the binding and reacts to the message with a unicode emoji', async () => {
            const interaction = makeInteraction({ sub: 'add', emoji: '⭐', role: { id: 'role1', managed: false, name: 'VIP' } });
            ReactionRoleSchema.findOne.mockResolvedValue(null);

            await reactionrole.execute(interaction);

            expect(ReactionRoleSchema.create).toHaveBeenCalledWith(
                expect.objectContaining({ guildId: 'g1', messageId: 'msg1', emoji: '⭐', roleId: 'role1' })
            );
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Done') })
            );
        });

        test('parses a custom emoji into its numeric ID for storage', async () => {
            const interaction = makeInteraction({ sub: 'add', emoji: '<:star:123456789>', role: { id: 'role1', managed: false, name: 'VIP' } });
            ReactionRoleSchema.findOne.mockResolvedValue(null);

            await reactionrole.execute(interaction);

            expect(ReactionRoleSchema.findOne).toHaveBeenCalledWith(
                expect.objectContaining({ emoji: '123456789' })
            );
            expect(ReactionRoleSchema.create).toHaveBeenCalledWith(
                expect.objectContaining({ emoji: '123456789' })
            );
        });

        test('still confirms the binding even if reacting to the message fails', async () => {
            const interaction = makeInteraction({ sub: 'add', role: { id: 'role1', managed: false, name: 'VIP' } });
            ReactionRoleSchema.findOne.mockResolvedValue(null);
            interaction.channel.messages.fetch.mockResolvedValue(null);

            await expect(reactionrole.execute(interaction)).resolves.not.toThrow();
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Done') })
            );
        });
    });

    describe('remove', () => {
        test('reports when no binding is found', async () => {
            const interaction = makeInteraction({ sub: 'remove' });
            ReactionRoleSchema.findOneAndDelete.mockResolvedValue(null);

            await reactionrole.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'No binding found for that emoji on that message.' })
            );
        });

        test('removes the binding when found', async () => {
            const interaction = makeInteraction({ sub: 'remove' });
            ReactionRoleSchema.findOneAndDelete.mockResolvedValue({ emoji: '⭐' });

            await reactionrole.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Binding removed.' })
            );
        });
    });

    describe('setup', () => {
        test('shows the reaction role embed modal', async () => {
            const interaction = makeInteraction({ sub: 'setup' });

            await reactionrole.execute(interaction);

            expect(interaction.showModal).toHaveBeenCalled();
            const modal = interaction.showModal.mock.calls[0][0];
            expect(modal.data.custom_id).toBe('rr_setup:chan1');
        });
    });

    describe('list', () => {
        test('reports no reaction roles configured', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            ReactionRoleSchema.find.mockResolvedValue([]);

            await reactionrole.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'No reaction roles configured for this server.' })
            );
        });

        test('lists configured bindings', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            ReactionRoleSchema.find.mockResolvedValue([{ emoji: '⭐', roleId: 'role1', messageId: 'msg1' }]);

            await reactionrole.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });
});
