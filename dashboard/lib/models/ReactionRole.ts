import { model, models, Schema } from "mongoose";

// Field-for-field identical to the bot's models/ReactionRoleSchema.js — keep in sync.
export interface ReactionRoleDoc {
  guildId: string;
  messageId: string;
  emoji: string;
  roleId: string;
}

const reactionRoleSchema = new Schema<ReactionRoleDoc>({
  guildId:   { type: String, required: true },
  messageId: { type: String, required: true },
  emoji:     { type: String, required: true },
  roleId:    { type: String, required: true },
});

reactionRoleSchema.index({ guildId: 1, messageId: 1, emoji: 1 });

export default models.ReactionRole || model<ReactionRoleDoc>("ReactionRole", reactionRoleSchema);
