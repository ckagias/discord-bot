import { model, Schema, Document } from 'mongoose';

interface IMusicPlayer extends Document {
    guildId: string;
    nodeId: string;
    voiceChannelId: string;
    textChannelId: string;
    selfDeaf: boolean;
    selfMute: boolean;
    requesterId: string | null;
}

const musicPlayerSchema = new Schema<IMusicPlayer>({
    guildId:        { type: String, required: true, unique: true },
    nodeId:         { type: String, required: true },
    voiceChannelId: { type: String, required: true },
    textChannelId:  { type: String, required: true },
    selfDeaf:       { type: Boolean, default: true },
    selfMute:       { type: Boolean, default: false },
    requesterId:    { type: String, default: null },
});

export = model<IMusicPlayer>('MusicPlayer', musicPlayerSchema);
