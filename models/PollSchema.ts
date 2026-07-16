import { model, Schema, Document } from 'mongoose';

interface IPoll extends Document {
    guildId: string;
    channelId: string;
    messageId: string;
    hostId: string;
    question: string;
    options: string[];
    votes: Map<string, string[]>;
    endsAt: Date | null;
    ended: boolean;
}

const pollSchema = new Schema<IPoll>({
    guildId:   { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    hostId:    { type: String, required: true },
    question:  { type: String, required: true },
    options:   { type: [String], required: true },
    votes:     { type: Map, of: [String], default: {} },
    endsAt:    { type: Date, default: null },
    ended:     { type: Boolean, default: false },
});

pollSchema.index({ guildId: 1, ended: 1 });

export = model<IPoll>('Poll', pollSchema);
