const { roleHierarchyError } = require('../../utils/roleHierarchy');

function makeInteraction({ userId = 'invoker', ownerId = 'owner', highest = { position: 5 }, member = true } = {}) {
    return {
        user: { id: userId },
        member: member ? { roles: { highest } } : null,
        guild: { ownerId },
    };
}

describe('roleHierarchyError', () => {
    test('allows a role below the invoker\'s highest role', () => {
        expect(roleHierarchyError(makeInteraction(), { id: 'r1', position: 4 })).toBeNull();
    });

    test('rejects a role at the same position as the invoker\'s highest role', () => {
        expect(roleHierarchyError(makeInteraction(), { id: 'r1', position: 5 })).toBe(
            "You can't use <@&r1> here, because it is higher than or equal to your highest role."
        );
    });

    test('rejects a role above the invoker\'s highest role', () => {
        expect(roleHierarchyError(makeInteraction(), { id: 'r1', position: 9 })).toEqual(expect.stringContaining('<@&r1>'));
    });

    test('exempts the server owner, whatever their roles', () => {
        const interaction = makeInteraction({ userId: 'owner', highest: { position: 0 } });
        expect(roleHierarchyError(interaction, { id: 'r1', position: 50 })).toBeNull();
    });

    test('rejects when the invoker\'s roles cannot be read', () => {
        expect(roleHierarchyError(makeInteraction({ member: false }), { id: 'r1', position: 1 })).not.toBeNull();
        const noRoles = { user: { id: 'invoker' }, member: { roles: {} }, guild: { ownerId: 'owner' } };
        expect(roleHierarchyError(noRoles, { id: 'r1', position: 1 })).not.toBeNull();
    });
});
