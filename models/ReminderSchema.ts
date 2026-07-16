import { model, Schema, Document } from 'mongoose';

interface IReminder extends Document {
    userId: string;
    guildId: string;
    channelId: string;
    message: string;
    remindAt: Date;
    sent: boolean;
}

const reminderSchema = new Schema<IReminder>({
    userId:     { type: String, required: true },
    guildId:    { type: String, required: true },
    channelId:  { type: String, required: true },
    message:    { type: String, required: true },
    remindAt:   { type: Date, required: true },
    sent:       { type: Boolean, default: false },
});

reminderSchema.index({ sent: 1, remindAt: 1 });

export = model<IReminder>('Reminder', reminderSchema);
