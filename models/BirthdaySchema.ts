import { model, Schema, Document } from 'mongoose';

interface IBirthday extends Document {
    userId: string;
    guildId: string;
    month: number; // 1-12
    day: number; // 1-31
    year: number | null;
    lastAnnounced: number | null; // year last announced, prevents duplicate posts
}

const birthdaySchema = new Schema<IBirthday>({
    userId:       { type: String, required: true },
    guildId:      { type: String, required: true },
    month:        { type: Number, required: true }, // 1-12
    day:          { type: Number, required: true }, // 1-31
    year:         { type: Number, default: null },
    lastAnnounced: { type: Number, default: null }, // year last announced, prevents duplicate posts
});

birthdaySchema.index({ guildId: 1, userId: 1 }, { unique: true });
birthdaySchema.index({ guildId: 1, month: 1, day: 1 });

export = model<IBirthday>('Birthday', birthdaySchema);
