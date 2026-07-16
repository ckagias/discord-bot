jest.mock('../../models/ReactionRoleSchema', () => ({ findOne: jest.fn() }));
jest.mock('../../utils/starboard', () => ({ handleStarReaction: jest.fn() }));

const ReactionRoleSchema = require('../../models/ReactionRoleSchema');
const { handleStarReaction } = require('../../utils/starboard');
const messageReactionAdd = require('../../events/messageReactionAdd');

function makeReaction({ partial = false, guild = { id: 'g1', members: { cache: { get: jest.fn() }, fetch: jest.fn() }, roles: { cache: { get: jest.fn() } } } }: { partial?: boolean; guild?: any } = {}) {
    return {
        partial,
        fetch: jest.fn().mockResolvedValue({}),
        message: { id: 'msg1', guild },
        emoji: { id: null, name: '⭐' },
    };
}

describe('messageReactionAdd', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ReactionRoleSchema.findOne.mockResolvedValue(null);
        handleStarReaction.mockResolvedValue({});
    });

    test('ignores reactions from bots', async () => {
        const reaction = makeReaction();
        const user = { id: 'bot1', bot: true };

        await messageReactionAdd.execute(reaction, user);

        expect(handleStarReaction).not.toHaveBeenCalled();
    });

    test('fetches a partial reaction before processing', async () => {
        const reaction = makeReaction({ partial: true });
        const user = { id: 'user1', bot: false };

        await messageReactionAdd.execute(reaction, user);

        expect(reaction.fetch).toHaveBeenCalled();
    });

    test('bails out silently if fetching a partial reaction fails', async () => {
        const reaction = makeReaction({ partial: true });
        reaction.fetch.mockRejectedValue(new Error('unknown message'));
        const user = { id: 'user1', bot: false };

        await messageReactionAdd.execute(reaction, user);

        expect(handleStarReaction).not.toHaveBeenCalled();
    });

    test('ignores reactions outside a guild (DMs)', async () => {
        const reaction = makeReaction({ guild: null });
        const user = { id: 'user1', bot: false };

        await messageReactionAdd.execute(reaction, user);

        expect(handleStarReaction).not.toHaveBeenCalled();
    });

    test('assigns the mapped role when a reaction-role binding exists', async () => {
        const addRole = jest.fn().mockResolvedValue({});
        const role = { id: 'role1' };
        const member = { roles: { add: addRole } };
        const guild = { id: 'g1', members: { cache: { get: jest.fn().mockReturnValue(member) } }, roles: { cache: { get: jest.fn().mockReturnValue(role) } } };
        ReactionRoleSchema.findOne.mockResolvedValue({ roleId: 'role1' });
        const reaction = makeReaction({ guild });
        const user = { id: 'user1', bot: false };

        await messageReactionAdd.execute(reaction, user);

        expect(addRole).toHaveBeenCalledWith(role);
    });

    test('falls back to fetching the member when not cached', async () => {
        const addRole = jest.fn().mockResolvedValue({});
        const role = { id: 'role1' };
        const member = { roles: { add: addRole } };
        const guild = {
            id: 'g1',
            members: { cache: { get: jest.fn().mockReturnValue(undefined) }, fetch: jest.fn().mockResolvedValue(member) },
            roles: { cache: { get: jest.fn().mockReturnValue(role) } },
        };
        ReactionRoleSchema.findOne.mockResolvedValue({ roleId: 'role1' });
        const reaction = makeReaction({ guild });
        const user = { id: 'user1', bot: false };

        await messageReactionAdd.execute(reaction, user);

        expect(guild.members.fetch).toHaveBeenCalledWith('user1');
        expect(addRole).toHaveBeenCalledWith(role);
    });

    test('does nothing when the member cannot be found or fetched', async () => {
        const guild = {
            id: 'g1',
            members: { cache: { get: jest.fn().mockReturnValue(undefined) }, fetch: jest.fn().mockResolvedValue(null) },
            roles: { cache: { get: jest.fn() } },
        };
        ReactionRoleSchema.findOne.mockResolvedValue({ roleId: 'role1' });
        const reaction = makeReaction({ guild });
        const user = { id: 'user1', bot: false };

        await expect(messageReactionAdd.execute(reaction, user)).resolves.not.toThrow();
    });

    test('does not throw if the role no longer exists', async () => {
        const member = { roles: { add: jest.fn() } };
        const guild = {
            id: 'g1',
            members: { cache: { get: jest.fn().mockReturnValue(member) } },
            roles: { cache: { get: jest.fn().mockReturnValue(undefined) } },
        };
        ReactionRoleSchema.findOne.mockResolvedValue({ roleId: 'gone-role' });
        const reaction = makeReaction({ guild });
        const user = { id: 'user1', bot: false };

        await expect(messageReactionAdd.execute(reaction, user)).resolves.not.toThrow();
        expect(member.roles.add).not.toHaveBeenCalled();
    });

    test('always runs the starboard check regardless of reaction-role matching', async () => {
        const reaction = makeReaction();
        const user = { id: 'user1', bot: false };

        await messageReactionAdd.execute(reaction, user);

        expect(handleStarReaction).toHaveBeenCalledWith(reaction);
    });

    test('continues without throwing when the starboard handler fails', async () => {
        handleStarReaction.mockRejectedValue(new Error('boom'));
        const reaction = makeReaction();
        const user = { id: 'user1', bot: false };

        await expect(messageReactionAdd.execute(reaction, user)).resolves.not.toThrow();
    });
});
