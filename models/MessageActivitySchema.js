const { model, Schema } = require('mongoose');

const messageActivitySchema = new Schema({
    guildId: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD, UTC
    count: { type: Number, default: 0 },
});

messageActivitySchema.index({ guildId: 1, date: 1 }, { unique: true });

module.exports = model('MessageActivity', messageActivitySchema);
