import { model, models, Schema } from "mongoose";

export interface MessageActivityDoc {
  guildId: string;
  date: string;
  count: number;
}

const messageActivitySchema = new Schema<MessageActivityDoc>({
  guildId: { type: String, required: true },
  date:    { type: String, required: true },
  count:   { type: Number, default: 0 },
});

messageActivitySchema.index({ guildId: 1, date: 1 }, { unique: true });

export default models.MessageActivity || model<MessageActivityDoc>("MessageActivity", messageActivitySchema);
