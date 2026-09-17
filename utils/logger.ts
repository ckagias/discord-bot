import { Guild } from 'discord.js';
import { getGuildConfig } from './guildConfig';

type LogCategory = 'member' | 'moderation' | 'message' | 'voice';

const CATEGORY_FIELDS: Record<LogCategory, string> = {
    member: 'memberLogChannelId',
    moderation: 'moderationLogChannelId',
    message: 'messageLogChannelId',
    voice: 'voiceLogChannelId',
};

// Category channel overrides the general logChannelId when set, so existing servers
// keep working unconfigured while admins can opt into splitting categories out.
async function getLogChannel(guild: Guild, category?: LogCategory) {
    const guildData = await getGuildConfig(guild.id);
    if (!guildData) return null;

    const channelId = (category && (guildData as any)[CATEGORY_FIELDS[category]]) || guildData.logChannelId;
    if (!channelId) return null;

    return guild.channels.cache.get(channelId) ?? null;
}

export { getLogChannel, CATEGORY_FIELDS };
export type { LogCategory };
