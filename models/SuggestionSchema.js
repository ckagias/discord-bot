const { model, Schema } = require('mongoose');

const suggestionSchema = new Schema({
    guildId:   { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    authorId:  { type: String, required: true },
    content:   { type: String, required: true },
    status:    { type: String, enum: ['pending', 'approved', 'denied', 'implemented'], default: 'pending' },
    upvotes:   { type: [String], default: [] },
    downvotes: { type: [String], default: [] },
    staffId:     { type: String, default: null },
    staffReason: { type: String, default: null },
}, { timestamps: true });

suggestionSchema.index({ guildId: 1, status: 1 });

module.exports = model('Suggestion', suggestionSchema);
