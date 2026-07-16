import { model, Schema, Document } from 'mongoose';

interface IPunishment extends Document {
    type: 'mute' | 'ban';
    guildId: string;
    userId: string;
    expiresAt: Date;
    muteRoleId: string | null; // only used for type 'mute'
}

const punishmentSchema = new Schema<IPunishment>({
    type:       { type: String, enum: ['mute', 'ban'], required: true },
    guildId:    { type: String, required: true },
    userId:     { type: String, required: true },
    expiresAt:  { type: Date, required: true },
    muteRoleId: { type: String, default: null }, // only used for type 'mute'
});

punishmentSchema.index({ guildId: 1, userId: 1, type: 1 });

export = model<IPunishment>('Punishment', punishmentSchema);
