import { Guild, GuildMember } from 'discord.js';
import { getGuildConfig } from './guildConfig';

const DEFAULT_WELCOME = 'Welcome to **{server}**, {user}!';
const DEFAULT_FAREWELL = '**{user}** has left **{server}**.';

function formatMessage(template: string, member: GuildMember, { mention = true }: { mention?: boolean } = {}): string {
    const userToken = mention ? `<@${member.user.id}>` : `**${member.user.username}**`;
    return template
        .replace(/{user}/g, userToken)
        .replace(/{server}/g, member.guild.name);
}

async function getWelcomeConfig(guild: Guild) {
    const guildData = await getGuildConfig(guild.id);
    if (!guildData?.welcomeChannelId) return null;
    const channel = guild.channels.cache.get(guildData.welcomeChannelId) ?? null;
    if (!channel) return null;
    return { channel, message: guildData.welcomeMessage || DEFAULT_WELCOME };
}

async function getFarewellConfig(guild: Guild) {
    const guildData = await getGuildConfig(guild.id);
    if (!guildData?.farewellChannelId) return null;
    const channel = guild.channels.cache.get(guildData.farewellChannelId) ?? null;
    if (!channel) return null;
    return { channel, message: guildData.farewellMessage || DEFAULT_FAREWELL };
}

export { formatMessage, getWelcomeConfig, getFarewellConfig };
