import { model, Schema, Document } from 'mongoose';

interface IReactionRole extends Document {
    guildId: string;
    messageId: string;
    emoji: string;
    roleId: string;
}

const reactionRoleSchema = new Schema<IReactionRole>({
    guildId: { type: String, required: true },
    messageId: { type: String, required: true },
    emoji: { type: String, required: true },
    roleId: { type: String, required: true },
});

reactionRoleSchema.index({ guildId: 1, messageId: 1, emoji: 1 });

export = model<IReactionRole>('ReactionRole', reactionRoleSchema);
