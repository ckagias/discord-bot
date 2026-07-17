jest.mock('../../../models/InventorySchema', () => ({ findOne: jest.fn() }));

const InventorySchema = require('../../../models/InventorySchema');
const inventory = require('../../../slashCommands/economy/inventory');

function makeMessage() {
    return {
        createMessageComponentCollector: jest.fn().mockReturnValue({ on: jest.fn() }),
    };
}

function makeInteraction() {
    const message = makeMessage();
    return {
        user: { id: 'user1', username: 'User' },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue(message),
        _message: message,
    };
}

describe('inventory command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('reports an empty inventory', async () => {
        const interaction = makeInteraction();
        InventorySchema.findOne.mockResolvedValue({ items: [] });

        await inventory.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('inventory is empty') })
        );
    });

    test('reports an empty inventory when no document exists yet', async () => {
        const interaction = makeInteraction();
        InventorySchema.findOne.mockResolvedValue(null);

        await inventory.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('inventory is empty') })
        );
    });

    test('renders a single page with no pagination buttons when items fit on one page', async () => {
        const interaction = makeInteraction();
        InventorySchema.findOne.mockResolvedValue({
            items: [{ itemId: 'i1', name: 'VIP', type: 'role', acquiredAt: new Date() }],
        });

        await inventory.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), components: [] })
        );
        expect(interaction._message.createMessageComponentCollector).not.toHaveBeenCalled();
    });

    test('renders pagination buttons and starts a collector when items span multiple pages', async () => {
        const interaction = makeInteraction();
        const items = Array.from({ length: 8 }, (_, i) => ({ itemId: `i${i}`, name: `Item ${i}`, type: 'badge', emoji: '⭐', acquiredAt: new Date() }));
        InventorySchema.findOne.mockResolvedValue({ items });

        await inventory.execute(interaction);

        const call = interaction.editReply.mock.calls[0][0];
        expect(call.components.length).toBe(1);
        expect(interaction._message.createMessageComponentCollector).toHaveBeenCalledWith({ time: 120_000 });
    });
});
