import { model, Schema, Document } from 'mongoose';

interface IWordle extends Document {
    userId: string;
    date: string; // YYYY-MM-DD
    guesses: string[]; // up to 6 guesses
    won: boolean;
    finished: boolean;
}

const wordleSchema = new Schema<IWordle>({
    userId:   { type: String, required: true },
    date:     { type: String, required: true }, // YYYY-MM-DD
    guesses:  { type: [String], default: [] },  // up to 6 guesses
    won:      { type: Boolean, default: false },
    finished: { type: Boolean, default: false },
});

wordleSchema.index({ userId: 1, date: 1 }, { unique: true });

export = model<IWordle>('Wordle', wordleSchema);
