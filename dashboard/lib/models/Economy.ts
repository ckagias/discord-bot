import { model, models, Schema } from "mongoose";

export interface EconomyDoc {
  userId: string;
  guildId: string;
  balance: number;
  lastDailyAt: Date | null;
  lastWorkAt: Date | null;
  lastRobAt: Date | null;
  dailyStreak: number;
}

const economySchema = new Schema<EconomyDoc>({
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

export default models.Economy || model<EconomyDoc>("Economy", economySchema);
