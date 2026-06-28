const { model, Schema } = require('mongoose');

const heistSchema = new Schema({
    messageId:  { type: String, required: true, unique: true },
    channelId:  { type: String, required: true },
    guildId:    { type: String, required: true },
    leaderId:   { type: String, required: true },
    entryFee:   { type: Number, required: true },
    // array of { userId, username } objects
    members:    { type: [{ userId: String, username: String }], default: [] },
    finished:   { type: Boolean, default: false },
});

module.exports = model('Heist', heistSchema);
