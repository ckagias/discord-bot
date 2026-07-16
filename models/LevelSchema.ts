import { model, Schema, Document } from 'mongoose';

interface ILevel extends Document {
    // Snowflakes stored as strings — exceed JS safe integer limit
    userId: string;
    guildId: string;
    xp: number;
    level: number;
    lastXpAt: Date | null;
}

const levelSchema = new Schema<ILevel>({
    // Snowflakes stored as strings — exceed JS safe integer limit
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    lastXpAt: { type: Date, default: null },
});

levelSchema.index({ userId: 1, guildId: 1 }, { unique: true });

export = model<ILevel>('Level', levelSchema);
