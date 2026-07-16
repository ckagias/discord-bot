import { model, Schema, Document } from 'mongoose';

interface IMessageActivity extends Document {
    guildId: string;
    date: string; // YYYY-MM-DD, UTC
    count: number;
}

const messageActivitySchema = new Schema<IMessageActivity>({
    guildId: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD, UTC
    count: { type: Number, default: 0 },
});

messageActivitySchema.index({ guildId: 1, date: 1 }, { unique: true });

export = model<IMessageActivity>('MessageActivity', messageActivitySchema);
