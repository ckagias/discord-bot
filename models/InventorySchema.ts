import { model, Schema, Document } from 'mongoose';

interface InventoryItem {
    itemId: string;
    name: string;
    type: string;
    emoji: string | null;
    acquiredAt: Date;
}

interface IInventory extends Document {
    userId: string;
    guildId: string;
    items: InventoryItem[];
}

const inventoryItemSchema = new Schema<InventoryItem>({
    itemId:     { type: String, required: true },
    name:       { type: String, required: true },
    type:       { type: String, required: true },
    emoji:      { type: String, default: null },
    acquiredAt: { type: Date, default: Date.now },
}, { _id: false });

const inventorySchema = new Schema<IInventory>({
    userId:  { type: String, required: true },
    guildId: { type: String, required: true },
    items: {
        type: [inventoryItemSchema],
        default: [],
    },
});

inventorySchema.index({ userId: 1, guildId: 1 }, { unique: true });

export = model<IInventory>('Inventory', inventorySchema);
