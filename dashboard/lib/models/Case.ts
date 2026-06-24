import { model, models, Schema } from "mongoose";

export interface CaseDoc {
  guildId: string;
  caseId: number;
  type: string;
  userId: string;
  moderatorId: string;
  reason: string;
  duration: string | null;
  createdAt: Date;
}

const caseSchema = new Schema<CaseDoc>({
  guildId:     { type: String, required: true },
  caseId:      { type: Number, required: true },
  type:        { type: String, required: true },
  userId:      { type: String, required: true },
  moderatorId: { type: String, required: true },
  reason:      { type: String, required: true },
  duration:    { type: String, default: null },
  createdAt:   { type: Date, default: Date.now },
});

caseSchema.index({ guildId: 1, caseId: 1 }, { unique: true });
caseSchema.index({ guildId: 1, userId: 1 });

export default models.Case || model<CaseDoc>("Case", caseSchema);
