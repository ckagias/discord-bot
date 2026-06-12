const GuildSchema = require('../models/GuildSchema');

async function getLogChannel(guild) {
    const guildData = await GuildSchema.findOne({ guildId: guild.id });
    if (!guildData?.logChannelId) return null;
    return guild.channels.cache.get(guildData.logChannelId) ?? null;
}

module.exports = { getLogChannel };