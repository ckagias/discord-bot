import { model, Schema, Document } from 'mongoose';

interface IHangman extends Document {
    messageId: string;
    userId: string;
    guildId: string;
    word: string;
    guessed: string[];
    wrong: number;
    finished: boolean;
    won: boolean;
}

const hangmanSchema = new Schema<IHangman>({
    messageId: { type: String, required: true, unique: true },
    userId:    { type: String, required: true },
    guildId:   { type: String, required: true },
    word:      { type: String, required: true },
    guessed:   { type: [String], default: [] },
    wrong:     { type: Number, default: 0 },
    finished:  { type: Boolean, default: false },
    won:       { type: Boolean, default: false },
});

export = model<IHangman>('Hangman', hangmanSchema);
