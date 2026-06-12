const { model, Schema } = require('mongoose');

const guildSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    levelingEnabled: { type: Boolean, default: false },
    logChannelId: { type: String, default: null },
});

module.exports = model('Guild', guildSchema);