import { model, models, Schema } from "mongoose";

// Field-for-field identical to the bot's models/GuildSchema.js — keep in sync.
export interface WarnThreshold {
  count: number;
  action: "timeout" | "kick" | "ban";
  duration: number | null;
}

export interface GuildDoc {
  guildId: string;
  levelingEnabled: boolean;
  logChannelId: string | null;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  farewellChannelId: string | null;
  farewellMessage: string | null;
  muteRoleId: string | null;
  ticketCategoryId: string | null;
  ticketSupportRoleId: string | null;
  ticketCount: number;
  automodEnabled: boolean;
  automodBannedWords: boolean;
  automodSpam: boolean;
  automodMentions: boolean;
  automodInvites: boolean;
  automodAction: "delete" | "warn" | "timeout";
  automodTimeoutSeconds: number;
  automodBannedWordList: string[];
  automodMentionLimit: number;
  warnThresholds: WarnThreshold[];
}

const guildSchema = new Schema<GuildDoc>({
  guildId: { type: String, required: true, unique: true },
  levelingEnabled: { type: Boolean, default: false },
  logChannelId: { type: String, default: null },
  welcomeChannelId: { type: String, default: null },
  welcomeMessage: { type: String, default: null },
  farewellChannelId: { type: String, default: null },
  farewellMessage: { type: String, default: null },
  muteRoleId: { type: String, default: null },
  ticketCategoryId: { type: String, default: null },
  ticketSupportRoleId: { type: String, default: null },
  ticketCount: { type: Number, default: 0 },
  automodEnabled: { type: Boolean, default: false },
  automodBannedWords: { type: Boolean, default: false },
  automodSpam: { type: Boolean, default: false },
  automodMentions: { type: Boolean, default: false },
  automodInvites: { type: Boolean, default: false },
  automodAction: { type: String, default: "delete" },
  automodTimeoutSeconds: { type: Number, default: 300 },
  automodBannedWordList: { type: [String], default: [] },
  automodMentionLimit: { type: Number, default: 5 },
  warnThresholds: {
    type: [
      {
        _id: false,
        count:    { type: Number, required: true },
        action:   { type: String, required: true },
        duration: { type: Number, default: null },
      },
    ],
    default: [],
  },
});

export default models.Guild || model<GuildDoc>("Guild", guildSchema);