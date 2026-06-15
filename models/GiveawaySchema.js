const { model, Schema } = require('mongoose');

const giveawaySchema = new Schema({
    guildId:    { type: String, required: true },
    channelId:  { type: String, required: true },
    messageId:  { type: String, required: true, unique: true },
    hostId:     { type: String, required: true },
    prize:      { type: String, required: true },
    winnerCount:{ type: Number, default: 1 },
    endsAt:     { type: Date, required: true },
    ended:      { type: Boolean, default: false },
    entrants:   { type: [String], default: [] },
    winners:    { type: [String], default: [] },
});

giveawaySchema.index({ guildId: 1, ended: 1 });

module.exports = model('Giveaway', giveawaySchema);
