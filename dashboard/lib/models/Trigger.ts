import { model, models, Schema } from "mongoose";

// Field-for-field identical to the bot's models/TriggerSchema.js — keep in sync.
export interface TriggerDoc {
  guildId: string;
  trigger: string;
  response: string;
}

const triggerSchema = new Schema<TriggerDoc>({
  guildId:  { type: String, required: true },
  trigger:  { type: String, required: true },
  response: { type: String, required: true },
});

triggerSchema.index({ guildId: 1 });

export default models.Trigger || model<TriggerDoc>("Trigger", triggerSchema);
