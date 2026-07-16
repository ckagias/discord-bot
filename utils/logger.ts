import { Guild } from 'discord.js';
import { getGuildConfig } from './guildConfig';

async function getLogChannel(guild: Guild) {
    const guildData = await getGuildConfig(guild.id);
    if (!guildData?.logChannelId) return null;
    return guild.channels.cache.get(guildData.logChannelId) ?? null;
}

export { getLogChannel };
