const { model, Schema } = require('mongoose');

const economySchema = new Schema({
    // Snowflakes stored as strings — exceed JS safe integer limit
    userId:      { type: String, required: true },
    guildId:     { type: String, required: true },
    balance:     { type: Number, default: 0 },
    lastDailyAt: { type: Date, default: null },
    lastWorkAt:  { type: Date, default: null },
    lastRobAt:   { type: Date, default: null },
    dailyStreak: { type: Number, default: 0 },
});

economySchema.index({ userId: 1, guildId: 1 }, { unique: true });
economySchema.index({ guildId: 1, balance: -1 });

module.exports = model('Economy', economySchema);
