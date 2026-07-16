import { model, Schema, Document } from 'mongoose';

interface ICase extends Document {
    guildId: string;
    caseId: number;
    type: string;
    userId: string;
    moderatorId: string;
    reason: string;
    duration: string | null;
    createdAt: Date;
}

const caseSchema = new Schema<ICase>({
    guildId: { type: String, required: true },
    caseId: { type: Number, required: true },
    type: { type: String, required: true }, // warn, kick, ban, mute, timeout, unban, unmute
    userId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true },
    duration: { type: String, default: null }, // human-readable, e.g. "7d"
    createdAt: { type: Date, default: Date.now },
});

caseSchema.index({ guildId: 1, caseId: 1 }, { unique: true });
caseSchema.index({ guildId: 1, userId: 1 });

export = model<ICase>('Case', caseSchema);
