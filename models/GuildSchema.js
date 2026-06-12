const { model, Schema } = require('mongoose');

const guildSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    levelingEnabled: { type: Boolean, default: false },
    logChannelId: { type: String, default: null },
    welcomeChannelId: { type: String, default: null },
    welcomeMessage: { type: String, default: null },
    farewellChannelId: { type: String, default: null },
    farewellMessage: { type: String, default: null },
});

module.exports = model('Guild', guildSchema);