jest.mock('../../../models/ShopSchema', () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    create: jest.fn(),
}));

const ShopSchema = require('../../../models/ShopSchema');
const shopmanage = require('../../../slashCommands/economy/shopmanage');

function makeInteraction({ sub, name = 'VIP', price = 500, type = 'role', description = null, role = { id: 'role1' }, emoji = null, item = 'item1', enabled = null } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getString: jest.fn((opt) => {
                if (opt === 'name') return name;
                if (opt === 'type') return type;
                if (opt === 'description') return description;
                if (opt === 'emoji') return emoji;
                if (opt === 'item') return item;
                return null;
            }),
            getInteger: jest.fn().mockReturnValue(price),
            getRole: jest.fn().mockReturnValue(role),
            getBoolean: jest.fn().mockReturnValue(enabled),
        },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('shopmanage command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('add', () => {
        test('rejects a role-type item with no role provided', async () => {
            const interaction = makeInteraction({ sub: 'add', type: 'role', role: null });

            await shopmanage.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('must provide a **role**') })
            );
            expect(ShopSchema.create).not.toHaveBeenCalled();
        });

        test('rejects a badge-type item with no emoji provided', async () => {
            const interaction = makeInteraction({ sub: 'add', type: 'badge', emoji: null });

            await shopmanage.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('must provide an **emoji**') })
            );
        });

        test('rejects a duplicate item name (case-insensitive)', async () => {
            const interaction = makeInteraction({ sub: 'add', name: 'VIP' });
            ShopSchema.findOne.mockResolvedValue({ name: 'vip' });

            await shopmanage.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('already exists') })
            );
            expect(ShopSchema.create).not.toHaveBeenCalled();
        });

        test('creates a new shop item', async () => {
            const interaction = makeInteraction({ sub: 'add', name: 'VIP', price: 500, type: 'role' });
            ShopSchema.findOne.mockResolvedValue(null);

            await shopmanage.execute(interaction);

            expect(ShopSchema.create).toHaveBeenCalledWith(
                expect.objectContaining({ guildId: 'g1', name: 'VIP', price: 500, type: 'role', roleId: 'role1' })
            );
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Added') })
            );
        });
    });

    describe('remove', () => {
        test('reports not found when the item does not exist', async () => {
            const interaction = makeInteraction({ sub: 'remove' });
            ShopSchema.findOneAndDelete.mockResolvedValue(null);

            await shopmanage.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Item not found.' })
            );
        });

        test('deletes the item when found', async () => {
            const interaction = makeInteraction({ sub: 'remove' });
            ShopSchema.findOneAndDelete.mockResolvedValue({ name: 'VIP' });

            await shopmanage.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Removed') })
            );
        });
    });

    describe('edit', () => {
        test('reports not found when the item does not exist', async () => {
            const interaction = makeInteraction({ sub: 'edit' });
            ShopSchema.findOne.mockResolvedValue(null);

            await shopmanage.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Item not found.' })
            );
        });

        test('only updates fields that were explicitly provided', async () => {
            const item = { name: 'Old', price: 100, description: 'old desc', enabled: true, save: jest.fn().mockResolvedValue({}) };
            const interaction = makeInteraction({ sub: 'edit', name: 'New', price: null, description: null, enabled: null });
            ShopSchema.findOne.mockResolvedValue(item);

            await shopmanage.execute(interaction);

            expect(item.name).toBe('New');
            expect(item.price).toBe(100);
            expect(item.save).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        test('reports empty shop', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            ShopSchema.find.mockResolvedValue([]);

            await shopmanage.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'No items in the shop yet.' })
            );
        });

        test('lists all items including hidden ones', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            ShopSchema.find.mockResolvedValue([{ name: 'VIP', type: 'role', price: 500, enabled: false }]);

            await shopmanage.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('autocomplete', () => {
        test('suggests items matching the focus string, marking hidden ones', async () => {
            const interaction = {
                options: { getFocused: jest.fn().mockReturnValue('vi') },
                guild: { id: 'g1' },
                respond: jest.fn().mockResolvedValue({}),
            };
            ShopSchema.find.mockResolvedValue([{ itemId: 'item1', name: 'VIP', price: 500, enabled: false }]);

            await shopmanage.autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([
                { name: 'VIP [hidden] — 500 coins', value: 'item1' },
            ]);
        });
    });
});
