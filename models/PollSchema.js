const { model, Schema } = require('mongoose');

const pollSchema = new Schema({
    guildId:   { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    hostId:    { type: String, required: true },
    question:  { type: String, required: true },
    options:   { type: [String], required: true },
    votes:     { type: Map, of: [String], default: {} },
    endsAt:    { type: Date, default: null },
    ended:     { type: Boolean, default: false },
});

pollSchema.index({ guildId: 1, ended: 1 });

module.exports = model('Poll', pollSchema);
