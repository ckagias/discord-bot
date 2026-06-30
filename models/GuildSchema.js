const { model, Schema } = require('mongoose');

const guildSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    levelingEnabled: { type: Boolean, default: false },
    logChannelId: { type: String, default: null },
    welcomeChannelId: { type: String, default: null },
    welcomeMessage: { type: String, default: null },
    farewellChannelId: { type: String, default: null },
    farewellMessage: { type: String, default: null },
    muteRoleId: { type: String, default: null },
    ticketCategoryId: { type: String, default: null },
    ticketSupportRoleId: { type: String, default: null },
    ticketCount: { type: Number, default: 0 },
    automodEnabled: { type: Boolean, default: false },
    automodBannedWords: { type: Boolean, default: false },
    automodSpam: { type: Boolean, default: false },
    automodMentions: { type: Boolean, default: false },
    automodInvites: { type: Boolean, default: false },
    automodAction: { type: String, default: 'delete' },
    automodTimeoutSeconds: { type: Number, default: 300 },
    automodBannedWordList: { type: [String], default: [] },
    automodMentionLimit: { type: Number, default: 5 },
    warnThresholds: {
        type: [
            {
                _id: false,
                count:    { type: Number, required: true },
                action:   { type: String, enum: ['timeout', 'kick', 'ban'], required: true },
                duration: { type: Number, default: null }, // seconds, only used for timeout
            },
        ],
        default: [],
    },
    levelRoles: {
        type: [
            {
                _id: false,
                level:  { type: Number, required: true },
                roleId: { type: String, required: true },
            },
        ],
        default: [],
    },
    levelUpChannelId: { type: String, default: null },
    autoroleId:          { type: String,  default: null },
    tempVcCategoryId:    { type: String,  default: null },
    starboardEnabled:    { type: Boolean, default: false },
    starboardChannelId:  { type: String,  default: null },
    starboardEmoji:      { type: String,  default: '⭐' },
    starboardThreshold:  { type: Number,  default: 3 },
    starboardIgnoreNsfw: { type: Boolean, default: true },
    antiRaidEnabled:           { type: Boolean, default: false },
    antiRaidQuarantineRoleId:  { type: String,  default: null },
    antiRaidJoinThreshold:     { type: Number,  default: 10 },
    antiRaidJoinWindow:        { type: Number,  default: 10 },
    antiRaidAlertChannelId:    { type: String,  default: null },
    antiRaidLocked:            { type: Boolean, default: false },
    antiRaidLockedAt:          { type: Date,    default: null },
    caseCounter:               { type: Number,  default: 0 },
});

module.exports = model('Guild', guildSchema);