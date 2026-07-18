import { model, Schema, Document } from 'mongoose';

interface IStarboard extends Document {
    guildId: string;
    channelId: string; // original message's channel
    messageId: string; // original message id
    starboardMessageId: string; // posted embed in the starboard channel
    starCount: number;
}

const starboardSchema = new Schema<IStarboard>({
    guildId:            { type: String, required: true },
    channelId:          { type: String, required: true }, // original message's channel
    messageId:          { type: String, required: true }, // original message id
    starboardMessageId: { type: String, required: true }, // posted embed in the starboard channel
    starCount:          { type: Number, default: 0 },
});

starboardSchema.index({ guildId: 1, messageId: 1 }, { unique: true });

export = model<IStarboard>('Starboard', starboardSchema);
