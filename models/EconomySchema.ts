import { model, Schema, Document } from 'mongoose';

interface IEconomy extends Document {
    // Snowflakes stored as strings — exceed JS safe integer limit
    userId: string;
    guildId: string;
    balance: number;
    lastDailyAt: Date | null;
    lastWorkAt: Date | null;
    lastRobAt: Date | null;
    dailyStreak: number;
}

const economySchema = new Schema<IEconomy>({
    // Snowflakes stored as strings — exceed JS safe integer limit
    userId:      { type: String, required: true },
    guildId:     { type: String, required: true },
    balance:     { type: Number, default: 0 },
    lastDailyAt: { type: Date, default: null },
    lastWorkAt:  { type: Date, default: null },
    lastRobAt:   { type: Date, default: null },
    dailyStreak: { type: Number, default: 0 },
});

economySchema.index({ userId: 1, guildId: 1 }, { unique: true });
economySchema.index({ guildId: 1, balance: -1 });

export = model<IEconomy>('Economy', economySchema);
