import { model, Schema, Document } from 'mongoose';

interface IMusicQueue extends Document {
    guildId: string;
    data: string;
}

const musicQueueSchema = new Schema<IMusicQueue>({
    guildId: { type: String, required: true, unique: true },
    data:    { type: String, required: true },
});

export = model<IMusicQueue>('MusicQueue', musicQueueSchema);
