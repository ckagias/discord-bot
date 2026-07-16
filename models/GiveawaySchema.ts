import { model, Schema, Document } from 'mongoose';

interface IGiveaway extends Document {
    guildId: string;
    channelId: string;
    messageId: string;
    hostId: string;
    prize: string;
    winnerCount: number;
    endsAt: Date;
    ended: boolean;
    entrants: string[];
    winners: string[];
    requireRoleId: string | null;
}

const giveawaySchema = new Schema<IGiveaway>({
    guildId:    { type: String, required: true },
    channelId:  { type: String, required: true },
    messageId:  { type: String, required: true, unique: true },
    hostId:     { type: String, required: true },
    prize:      { type: String, required: true },
    winnerCount:{ type: Number, default: 1 },
    endsAt:     { type: Date, required: true },
    ended:        { type: Boolean, default: false },
    entrants:     { type: [String], default: [] },
    winners:      { type: [String], default: [] },
    requireRoleId: { type: String, default: null },
});

giveawaySchema.index({ guildId: 1, ended: 1 });

export = model<IGiveaway>('Giveaway', giveawaySchema);
