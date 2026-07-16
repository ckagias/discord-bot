import { model, Schema, Document } from 'mongoose';

interface IWarn extends Document {
    guildId: string;
    userId: string;
    moderatorId: string;
    reason: string;
    createdAt: Date;
}

const warnSchema = new Schema<IWarn>({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

warnSchema.index({ guildId: 1, userId: 1 });

export = model<IWarn>('Warn', warnSchema);
