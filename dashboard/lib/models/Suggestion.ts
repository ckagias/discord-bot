import { model, models, Schema } from "mongoose";

export interface SuggestionDoc {
  guildId: string;
  channelId: string;
  messageId: string;
  authorId: string;
  content: string;
  status: "pending" | "approved" | "denied" | "implemented";
  upvotes: string[];
  downvotes: string[];
  staffId: string | null;
  staffReason: string | null;
  createdAt: Date;
}

const suggestionSchema = new Schema<SuggestionDoc>(
  {
    guildId:   { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    authorId:  { type: String, required: true },
    content:   { type: String, required: true },
    status:    { type: String, default: "pending" },
    upvotes:   { type: [String], default: [] },
    downvotes: { type: [String], default: [] },
    staffId:     { type: String, default: null },
    staffReason: { type: String, default: null },
  },
  { timestamps: true }
);

suggestionSchema.index({ guildId: 1, status: 1 });

export default models.Suggestion || model<SuggestionDoc>("Suggestion", suggestionSchema);
