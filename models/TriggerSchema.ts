import { model, Schema, Document } from 'mongoose';

interface ITrigger extends Document {
    guildId: string;
    trigger: string;
    response: string;
}

const triggerSchema = new Schema<ITrigger>({
    guildId: { type: String, required: true },
    trigger: { type: String, required: true },
    response: { type: String, required: true },
});

triggerSchema.index({ guildId: 1 });

export = model<ITrigger>('Trigger', triggerSchema);
