import { model, Schema, Document } from 'mongoose';

interface HeistMember {
    userId?: string;
    username?: string;
}

interface IHeist extends Document {
    messageId: string;
    channelId: string;
    guildId: string;
    leaderId: string;
    entryFee: number;
    members: HeistMember[];
    finished: boolean;
}

const heistSchema = new Schema<IHeist>({
    messageId:  { type: String, required: true, unique: true },
    channelId:  { type: String, required: true },
    guildId:    { type: String, required: true },
    leaderId:   { type: String, required: true },
    entryFee:   { type: Number, required: true },
    members:    { type: [{ userId: String, username: String }], default: [] },
    finished:   { type: Boolean, default: false },
});

export = model<IHeist>('Heist', heistSchema);
