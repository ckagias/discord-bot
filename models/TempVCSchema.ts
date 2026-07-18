import { model, Schema, Document } from 'mongoose';

interface ITempVC extends Document {
    guildId: string;
    channelId: string;
    ownerId: string;
}

const tempVCSchema = new Schema<ITempVC>({
    guildId:   { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    ownerId:   { type: String, required: true },
});

export = model<ITempVC>('TempVC', tempVCSchema);
