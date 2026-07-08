const userinfo = require('../../../slashCommands/info/userinfo');

function makeCollection(items) {
    const map = new Map(items.map((item, i) => [i, item]));
    map.filter = (fn) => makeCollection([...map.values()].filter(fn));
    map.sort = () => map;
    map.map = (fn) => [...map.values()].map(fn);
    map.indexOf = (id) => [...map.values()].indexOf(id);
    return map;
}

function makeUser(overrides = {}) {
    return {
        id: 'user1',
        tag: 'User#0001',
        bot: false,
        createdTimestamp: Date.now(),
        displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png'),
        fetch: jest.fn(),
        ...overrides,
    };
}

function makeInteraction({ user = null, member = null, allMembers = null } = {}) {
    const self = makeUser({ id: 'self1' });
    const fetchedUser = makeUser({ flags: { toArray: () => [] }, accentColor: null, banner: null });
    self.fetch = jest.fn().mockResolvedValue(fetchedUser);
    if (user) user.fetch = jest.fn().mockResolvedValue(fetchedUser);

    return {
        options: { getUser: jest.fn().mockReturnValue(user) },
        user: self,
        guild: {
            id: 'g1',
            members: {
                fetch: jest.fn((id) => {
                    if (id === undefined) return Promise.resolve(allMembers ?? makeCollection([]));
                    return Promise.resolve(member);
                }),
            },
        },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('userinfo command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('defaults to the invoking user when no user is specified', async () => {
        const interaction = makeInteraction({ user: null });

        await userinfo.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('shows "N/A" join date when the target is not a guild member', async () => {
        const target = makeUser({ id: 'target1' });
        const interaction = makeInteraction({ user: target, member: null });
        interaction.guild.members.fetch = jest.fn().mockRejectedValue(new Error('not found'));

        await expect(userinfo.execute(interaction)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('shows guild-specific info (roles, nickname) when the target is a member', async () => {
        const target = makeUser({ id: 'target1' });
        const member = {
            joinedTimestamp: Date.now(),
            nickname: 'Nicky',
            roles: { cache: makeCollection([{ id: 'g1', position: 0 }, { id: 'role1', position: 1 }]) },
            displayAvatarURL: jest.fn().mockReturnValue('https://example.com/member.png'),
            presence: null,
            voice: { channel: null },
            premiumSinceTimestamp: null,
        };
        const interaction = makeInteraction({ user: target, member });
        interaction.guild.members.fetch = jest.fn()
            .mockImplementation((id) => (id ? Promise.resolve(member) : Promise.resolve(makeCollection([]))));

        await expect(userinfo.execute(interaction)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('adds a banner image when the fetched user has one', async () => {
        const target = makeUser({ id: 'target1' });
        const fetchedUserWithBanner = makeUser({
            id: 'target1',
            flags: { toArray: () => [] },
            accentColor: null,
            banner: 'abc123',
            bannerURL: jest.fn().mockReturnValue('https://example.com/banner.png'),
        });
        target.fetch = jest.fn().mockResolvedValue(fetchedUserWithBanner);
        const interaction = makeInteraction({ user: target, member: null });
        interaction.guild.members.fetch = jest.fn().mockRejectedValue(new Error('not found'));

        await expect(userinfo.execute(interaction)).resolves.not.toThrow();
    });
});
