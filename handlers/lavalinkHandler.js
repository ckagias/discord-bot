const { LavalinkManager } = require('lavalink-client');
const log = require('../utils/log');
const logger = log.scope('Lavalink');

module.exports = (client) => {
    client.lavalink = new LavalinkManager({
        nodes: [
            {
                host: process.env.LAVALINK_HOST || '127.0.0.1',
                port: parseInt(process.env.LAVALINK_PORT) || 2333,
                authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
                id: 'main',
            },
        ],
        sendToShard: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
        client: {
            id: process.env.ClientID,
            username: 'Discord Bot',
        },
        playerOptions: {
            defaultSearchPlatform: 'ytsearch',
            onDisconnect: {
                autoReconnect: true,
                destroyPlayer: false,
            },
            onEmptyQueue: {
                destroyAfterMs: 30_000,
            },
        },
    });

    client.lavalink.on('nodeConnect', (node) => {
        logger.info(`Node "${node.id}" connected`);
    });

    client.lavalink.on('nodeError', (node, error) => {
        logger.error(`Node "${node.id}" error:`, error.message);
    });

    client.lavalink.on('trackStart', (player, track) => {
        const channel = client.channels.cache.get(player.textChannelId);
        if (channel) channel.send(`Now playing: **${track.info.title}** by **${track.info.author}**`);
    });

    client.lavalink.on('queueEnd', (player) => {
        if (player.getData('manual_stop')) return;
        const channel = client.channels.cache.get(player.textChannelId);
        if (channel) channel.send('Queue finished. Leaving voice channel in 30 seconds.');
    });

    client.lavalink.on('playerDestroy', (player) => {
        const channel = client.channels.cache.get(player.textChannelId);
        if (channel) channel.send('Left the voice channel.').catch(() => {});
    });
};