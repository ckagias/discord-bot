import { model, Schema, Document } from 'mongoose';

interface ILavalinkSession extends Document {
    nodeId: string;
    sessionId: string;
}

const lavalinkSessionSchema = new Schema<ILavalinkSession>({
    nodeId:    { type: String, required: true, unique: true },
    sessionId: { type: String, required: true },
});

export = model<ILavalinkSession>('LavalinkSession', lavalinkSessionSchema);
