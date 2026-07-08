jest.mock('../../../utils/economy', () => ({
    getWallet: jest.fn(),
    updateBalance: jest.fn(),
    formatBalance: (n) => n.toLocaleString('en-US'),
}));
jest.mock('../../../models/ShopSchema', () => ({
    find: jest.fn(),
    findOne: jest.fn(),
}));
jest.mock('../../../models/InventorySchema', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
}));

const { getWallet, updateBalance } = require('../../../utils/economy');
const ShopSchema = require('../../../models/ShopSchema');
const InventorySchema = require('../../../models/InventorySchema');
const shop = require('../../../slashCommands/economy/shop');

function makeInteraction({ sub, item = 'item1' } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getString: jest.fn().mockReturnValue(item),
        },
        user: { id: 'user1' },
        guild: {
            id: 'g1',
            name: 'Test Guild',
            members: { fetch: jest.fn().mockResolvedValue({ roles: { add: jest.fn().mockResolvedValue({}), remove: jest.fn().mockResolvedValue({}) } }) },
        },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('shop command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('browse', () => {
        test('shows an empty-shop message when there are no items', async () => {
            const interaction = makeInteraction({ sub: 'browse' });
            ShopSchema.find.mockResolvedValue([]);

            await shop.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('shop is empty') })
            );
        });

        test('lists available items', async () => {
            const interaction = makeInteraction({ sub: 'browse' });
            ShopSchema.find.mockResolvedValue([{ name: 'VIP', type: 'role', price: 500, description: 'cool role' }]);

            await shop.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('buy', () => {
        test('rejects when the item does not exist', async () => {
            const interaction = makeInteraction({ sub: 'buy' });
            ShopSchema.findOne.mockResolvedValue(null);

            await shop.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('does not exist') })
            );
        });

        test('rejects when the item is already owned (inventory upsert filter excludes it)', async () => {
            const interaction = makeInteraction({ sub: 'buy' });
            ShopSchema.findOne.mockResolvedValue({ itemId: 'item1', name: 'VIP', price: 500, type: 'badge' });
            InventorySchema.findOneAndUpdate.mockResolvedValue(null);

            await shop.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('already own') })
            );
            expect(updateBalance).not.toHaveBeenCalled();
        });

        test('rolls back the inventory entry when the user cannot afford the item', async () => {
            const interaction = makeInteraction({ sub: 'buy' });
            ShopSchema.findOne.mockResolvedValue({ itemId: 'item1', name: 'VIP', price: 500, type: 'badge' });
            InventorySchema.findOneAndUpdate.mockResolvedValue({ items: [{ itemId: 'item1' }] });
            updateBalance.mockResolvedValueOnce(null);
            getWallet.mockResolvedValueOnce({ balance: 100 });

            await shop.execute(interaction);

            expect(InventorySchema.updateOne).toHaveBeenCalledWith(
                { userId: 'user1', guildId: 'g1' },
                { $pull: { items: { itemId: 'item1' } } }
            );
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("don't have enough coins") })
            );
        });

        test('completes a badge purchase without touching roles', async () => {
            const interaction = makeInteraction({ sub: 'buy' });
            ShopSchema.findOne.mockResolvedValue({ itemId: 'item1', name: 'Star', price: 100, type: 'badge', emoji: '⭐' });
            InventorySchema.findOneAndUpdate.mockResolvedValue({ items: [{ itemId: 'item1' }] });
            updateBalance.mockResolvedValueOnce({ balance: 400 });

            await shop.execute(interaction);

            expect(interaction.guild.members.fetch).not.toHaveBeenCalled();
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });

        test('refunds and rolls back inventory when a role purchase fails to grant the role', async () => {
            const interaction = makeInteraction({ sub: 'buy' });
            ShopSchema.findOne.mockResolvedValue({ itemId: 'item1', name: 'VIP', price: 500, type: 'role', roleId: 'role1' });
            InventorySchema.findOneAndUpdate.mockResolvedValue({ items: [{ itemId: 'item1' }] });
            updateBalance.mockResolvedValueOnce({ balance: 0 }).mockResolvedValueOnce({ balance: 500 });
            interaction.guild.members.fetch.mockResolvedValue({ roles: { add: jest.fn().mockResolvedValue(null) } });

            await shop.execute(interaction);

            expect(updateBalance).toHaveBeenNthCalledWith(2, 'user1', 'g1', 500);
            expect(InventorySchema.updateOne).toHaveBeenCalledWith(
                { userId: 'user1', guildId: 'g1' },
                { $pull: { items: { itemId: 'item1' } } }
            );
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('coins have been refunded') })
            );
        });
    });

    describe('sell', () => {
        test("rejects when the user doesn't own the item", async () => {
            const interaction = makeInteraction({ sub: 'sell' });
            InventorySchema.findOne.mockResolvedValue({ items: [] });

            await shop.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: "You don't own that item." })
            );
        });

        test('sells for 50% refund when the item still exists in the shop', async () => {
            const interaction = makeInteraction({ sub: 'sell' });
            InventorySchema.findOne.mockResolvedValue({ items: [{ itemId: 'item1', name: 'VIP', type: 'badge' }] });
            ShopSchema.findOne.mockResolvedValue({ itemId: 'item1', price: 200 });
            updateBalance.mockResolvedValue({ balance: 300 });

            await shop.execute(interaction);

            expect(updateBalance).toHaveBeenCalledWith('user1', 'g1', 100);
            expect(InventorySchema.updateOne).toHaveBeenCalledWith(
                { userId: 'user1', guildId: 'g1' },
                { $pull: { items: { itemId: 'item1' } } }
            );
        });

        test('sells for no refund when the item is no longer in the shop', async () => {
            const interaction = makeInteraction({ sub: 'sell' });
            InventorySchema.findOne.mockResolvedValue({ items: [{ itemId: 'item1', name: 'Old Item', type: 'badge' }] });
            ShopSchema.findOne.mockResolvedValue(null);
            getWallet.mockResolvedValue({ balance: 300 });

            await shop.execute(interaction);

            expect(updateBalance).not.toHaveBeenCalled();
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });

        test('revokes the role when selling a role-type item', async () => {
            const interaction = makeInteraction({ sub: 'sell' });
            InventorySchema.findOne.mockResolvedValue({ items: [{ itemId: 'item1', name: 'VIP', type: 'role' }] });
            ShopSchema.findOne.mockResolvedValue({ itemId: 'item1', price: 200, roleId: 'role1' });
            updateBalance.mockResolvedValue({ balance: 300 });
            const remove = jest.fn().mockResolvedValue({});
            interaction.guild.members.fetch.mockResolvedValue({ roles: { remove } });

            await shop.execute(interaction);

            expect(remove).toHaveBeenCalledWith('role1');
        });
    });

    describe('autocomplete', () => {
        test('sell: suggests owned items matching the focus string', async () => {
            const interaction = {
                options: {
                    getFocused: jest.fn().mockReturnValue('vi'),
                    getSubcommand: jest.fn().mockReturnValue('sell'),
                },
                user: { id: 'user1' },
                guild: { id: 'g1' },
                respond: jest.fn().mockResolvedValue({}),
            };
            InventorySchema.findOne.mockResolvedValue({ items: [{ itemId: 'item1', name: 'VIP' }, { itemId: 'item2', name: 'Star' }] });

            await shop.autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([{ name: 'VIP', value: 'item1' }]);
        });

        test('buy: suggests enabled shop items matching the focus string', async () => {
            const interaction = {
                options: {
                    getFocused: jest.fn().mockReturnValue('vi'),
                    getSubcommand: jest.fn().mockReturnValue('buy'),
                },
                guild: { id: 'g1' },
                respond: jest.fn().mockResolvedValue({}),
            };
            ShopSchema.find.mockResolvedValue([{ itemId: 'item1', name: 'VIP', price: 500 }]);

            await shop.autocomplete(interaction);

            expect(ShopSchema.find).toHaveBeenCalledWith({ guildId: 'g1', enabled: true });
            expect(interaction.respond).toHaveBeenCalledWith([{ name: 'VIP — 500 coins', value: 'item1' }]);
        });
    });
});
