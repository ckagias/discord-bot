const { model, Schema } = require('mongoose');

const punishmentSchema = new Schema({
    type:       { type: String, enum: ['mute', 'ban'], required: true },
    guildId:    { type: String, required: true },
    userId:     { type: String, required: true },
    expiresAt:  { type: Date, required: true },
    muteRoleId: { type: String, default: null }, // only used for type 'mute'
});

punishmentSchema.index({ guildId: 1, userId: 1, type: 1 });

module.exports = model('Punishment', punishmentSchema);
