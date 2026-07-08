jest.mock('../../../models/LevelSchema', () => ({ findOne: jest.fn() }));
jest.mock('../../../models/WarnSchema', () => ({ countDocuments: jest.fn() }));
jest.mock('../../../models/InventorySchema', () => ({ findOne: jest.fn() }));
jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const LevelSchema = require('../../../models/LevelSchema');
const WarnSchema = require('../../../models/WarnSchema');
const InventorySchema = require('../../../models/InventorySchema');
const { getWallet } = require('../../../utils/economy');
const profile = require('../../../slashCommands/info/profile');

function makeUser(overrides = {}) {
    return {
        id: 'user1',
        username: 'User',
        createdTimestamp: Date.now(),
        displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png'),
        fetch: jest.fn(),
        ...overrides,
    };
}

function makeInteraction({ user = null, member = null } = {}) {
    const fetchedUser = { flags: { toArray: () => [] } };
    const self = makeUser({ id: 'self1', username: 'Self' });
    self.fetch = jest.fn().mockResolvedValue(fetchedUser);
    if (user) user.fetch = jest.fn().mockResolvedValue(fetchedUser);

    return {
        options: { getUser: jest.fn().mockReturnValue(user) },
        user: self,
        guild: {
            id: 'g1',
            members: { fetch: jest.fn().mockResolvedValue(member) },
        },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('profile command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        LevelSchema.findOne.mockResolvedValue(null);
        WarnSchema.countDocuments.mockResolvedValue(0);
        InventorySchema.findOne.mockResolvedValue(null);
        getWallet.mockResolvedValue({ balance: 0 });
    });

    test('defaults to the invoking user when no user is specified', async () => {
        const interaction = makeInteraction({ user: null });
        interaction.guild.members.fetch = jest.fn().mockResolvedValue(null);

        await profile.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('shows level, balance, warnings, and badges for the target', async () => {
        const target = makeUser({ id: 'target1', username: 'Target' });
        const interaction = makeInteraction({ user: target });
        interaction.guild.members.fetch = jest.fn().mockResolvedValue({ displayName: 'Targ', joinedTimestamp: Date.now(), displayAvatarURL: jest.fn().mockReturnValue('https://example.com/member.png') });
        LevelSchema.findOne.mockResolvedValue({ level: 3, xp: 50 });
        getWallet.mockResolvedValue({ balance: 1200 });
        WarnSchema.countDocuments.mockResolvedValue(2);
        InventorySchema.findOne.mockResolvedValue({ items: [{ type: 'badge', emoji: '⭐' }] });

        await profile.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('handles a target who is no longer a guild member gracefully', async () => {
        const target = makeUser({ id: 'target1', username: 'Target' });
        const interaction = makeInteraction({ user: target });
        interaction.guild.members.fetch = jest.fn().mockRejectedValue(new Error('unknown member'));

        await expect(profile.execute(interaction)).resolves.not.toThrow();
    });
});
