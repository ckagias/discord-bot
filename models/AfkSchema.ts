import { model, Schema, Document } from 'mongoose';

interface IAfk extends Document {
    // Snowflakes stored as strings — exceed JS safe integer limit
    userId: string;
    guildId: string;
    reason: string;
    since: Date;
}

const afkSchema = new Schema<IAfk>({
    // Snowflakes stored as strings — exceed JS safe integer limit
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    reason: { type: String, default: 'No reason provided' },
    since: { type: Date, default: Date.now },
});

afkSchema.index({ userId: 1, guildId: 1 }, { unique: true });

export = model<IAfk>('Afk', afkSchema);
