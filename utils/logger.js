const { getGuildConfig } = require('./guildConfig');

async function getLogChannel(guild) {
    const guildData = await getGuildConfig(guild.id);
    if (!guildData?.logChannelId) return null;
    return guild.channels.cache.get(guildData.logChannelId) ?? null;
}

module.exports = { getLogChannel };