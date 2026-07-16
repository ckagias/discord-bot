jest.mock('../../models/ReactionRoleSchema', () => ({ findOne: jest.fn() }));
jest.mock('../../utils/starboard', () => ({ handleStarReaction: jest.fn() }));

const ReactionRoleSchema = require('../../models/ReactionRoleSchema');
const { handleStarReaction } = require('../../utils/starboard');
const messageReactionRemove = require('../../events/messageReactionRemove');

function makeReaction({ partial = false, guild = { id: 'g1', members: { cache: { get: jest.fn() }, fetch: jest.fn() }, roles: { cache: { get: jest.fn() } } } }: { partial?: boolean; guild?: any } = {}) {
    return {
        partial,
        fetch: jest.fn().mockResolvedValue({}),
        message: { id: 'msg1', guild },
        emoji: { id: null, name: '⭐' },
    };
}

describe('messageReactionRemove', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ReactionRoleSchema.findOne.mockResolvedValue(null);
        handleStarReaction.mockResolvedValue({});
    });

    test('ignores reactions from bots', async () => {
        const reaction = makeReaction();
        const user = { id: 'bot1', bot: true };

        await messageReactionRemove.execute(reaction, user);

        expect(handleStarReaction).not.toHaveBeenCalled();
    });

    test('ignores reactions outside a guild (DMs)', async () => {
        const reaction = makeReaction({ guild: null });
        const user = { id: 'user1', bot: false };

        await messageReactionRemove.execute(reaction, user);

        expect(handleStarReaction).not.toHaveBeenCalled();
    });

    test('removes the mapped role when a reaction-role binding exists', async () => {
        const removeRole = jest.fn().mockResolvedValue({});
        const role = { id: 'role1' };
        const member = { roles: { remove: removeRole } };
        const guild = { id: 'g1', members: { cache: { get: jest.fn().mockReturnValue(member) } }, roles: { cache: { get: jest.fn().mockReturnValue(role) } } };
        ReactionRoleSchema.findOne.mockResolvedValue({ roleId: 'role1' });
        const reaction = makeReaction({ guild });
        const user = { id: 'user1', bot: false };

        await messageReactionRemove.execute(reaction, user);

        expect(removeRole).toHaveBeenCalledWith(role);
    });

    test('does not throw if removing the role fails', async () => {
        const member = { roles: { remove: jest.fn().mockRejectedValue(new Error('missing perms')) } };
        const role = { id: 'role1' };
        const guild = { id: 'g1', members: { cache: { get: jest.fn().mockReturnValue(member) } }, roles: { cache: { get: jest.fn().mockReturnValue(role) } } };
        ReactionRoleSchema.findOne.mockResolvedValue({ roleId: 'role1' });
        const reaction = makeReaction({ guild });
        const user = { id: 'user1', bot: false };

        await expect(messageReactionRemove.execute(reaction, user)).resolves.not.toThrow();
    });

    test('always runs the starboard check regardless of reaction-role matching', async () => {
        const reaction = makeReaction();
        const user = { id: 'user1', bot: false };

        await messageReactionRemove.execute(reaction, user);

        expect(handleStarReaction).toHaveBeenCalledWith(reaction);
    });
});
