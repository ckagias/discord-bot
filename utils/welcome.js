const GuildSchema = require('../models/GuildSchema');

const DEFAULT_WELCOME = 'Welcome to **{server}**, {user}!';
const DEFAULT_FAREWELL = '**{user}** has left **{server}**.';

function formatMessage(template, member, { mention = true } = {}) {
    const userToken = mention ? `<@${member.user.id}>` : `**${member.user.username}**`;
    return template
        .replace(/{user}/g, userToken)
        .replace(/{server}/g, member.guild.name);
}

async function getWelcomeConfig(guild) {
    const guildData = await GuildSchema.findOne({ guildId: guild.id });
    if (!guildData?.welcomeChannelId) return null;
    const channel = guild.channels.cache.get(guildData.welcomeChannelId) ?? null;
    if (!channel) return null;
    return { channel, message: guildData.welcomeMessage || DEFAULT_WELCOME };
}

async function getFarewellConfig(guild) {
    const guildData = await GuildSchema.findOne({ guildId: guild.id });
    if (!guildData?.farewellChannelId) return null;
    const channel = guild.channels.cache.get(guildData.farewellChannelId) ?? null;
    if (!channel) return null;
    return { channel, message: guildData.farewellMessage || DEFAULT_FAREWELL };
}

module.exports = { formatMessage, getWelcomeConfig, getFarewellConfig };