import { Client, TextBasedChannel } from 'discord.js';
const { LavalinkManager } = require('lavalink-client') as typeof import('lavalink-client', { with: { 'resolution-mode': 'import' } });
import log from '../utils/log';
const logger = log.scope('Lavalink');

export = (client: Client) => {
    client.lavalink = new LavalinkManager({
        nodes: [
            {
                host: process.env.LAVALINK_HOST || '127.0.0.1',
                port: parseInt(process.env.LAVALINK_PORT as string) || 2333,
                authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
                id: 'main',
            },
        ],
        sendToShard: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
        client: {
            id: process.env.ClientID as string,
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

    (client.lavalink as any).on('nodeConnect', (node: any) => {
        logger.info(`Node "${node.id}" connected`);
    });

    (client.lavalink as any).on('nodeError', (node: any, error: any) => {
        logger.error(`Node "${node.id}" error:`, error.message);
    });

    client.lavalink.on('trackStart', (player, track) => {
        const channel = client.channels.cache.get(player.textChannelId as string) as TextBasedChannel | undefined;
        if (channel && 'send' in channel) channel.send(`Now playing: **${track?.info.title}** by **${track?.info.author}**`);
    });

    client.lavalink.on('queueEnd', (player) => {
        if (player.getData('manual_stop')) return;
        const channel = client.channels.cache.get(player.textChannelId as string) as TextBasedChannel | undefined;
        if (channel && 'send' in channel) channel.send('Queue finished. Leaving voice channel in 30 seconds.');
    });

    client.lavalink.on('playerDestroy', (player) => {
        const channel = client.channels.cache.get(player.textChannelId as string) as TextBasedChannel | undefined;
        if (channel && 'send' in channel) channel.send('Left the voice channel.').catch(() => {});
    });
};
