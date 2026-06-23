const GuildSchema = require('../models/GuildSchema');

function getGuildConfig(guildId) {
    return GuildSchema.findOne({ guildId });
}

// Ensures a config document exists for the guild and returns it, creating one with schema defaults if needed.
function ensureGuildConfig(guildId) {
    return GuildSchema.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        { upsert: true, returnDocument: 'after' }
    );
}

// Upserts the given fields onto the guild's config document.
function updateGuildConfig(guildId, fields) {
    return GuildSchema.findOneAndUpdate(
        { guildId },
        { $set: fields, $setOnInsert: { guildId } },
        { upsert: true }
    );
}

module.exports = { getGuildConfig, ensureGuildConfig, updateGuildConfig };
