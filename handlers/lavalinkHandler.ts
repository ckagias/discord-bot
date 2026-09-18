import { Client, TextBasedChannel } from 'discord.js';
const { LavalinkManager } = require('lavalink-client') as typeof import('lavalink-client', { with: { 'resolution-mode': 'import' } });
import log from '../utils/log';
import { mongoQueueStore, saveMusicPlayer, deleteMusicPlayer, getMusicPlayer, getSavedSessionId, saveSessionId } from '../utils/musicPersistence';
const logger = log.scope('Lavalink');

// How long Lavalink keeps a player alive after the bot's WS drops, so a quick `--bot` restart can resume it instead of losing playback.
const RESUME_TIMEOUT_MS = parseInt(process.env.LAVALINK_RESUME_TIMEOUT_MS as string) || 60_000;
const NODE_ID = 'main';

export = async (client: Client) => {
    // Passing the previous sessionId lets Lavalink hand back players it kept alive across this reconnect, instead of starting a fresh session.
    const savedSessionId = await getSavedSessionId(NODE_ID).catch(() => undefined);

    client.lavalink = new LavalinkManager({
        nodes: [
            {
                host: process.env.LAVALINK_HOST || '127.0.0.1',
                port: parseInt(process.env.LAVALINK_PORT as string) || 2333,
                authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
                id: NODE_ID,
                sessionId: savedSessionId,
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
        queueOptions: {
            queueStore: mongoQueueStore,
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

    (client.lavalink as any).nodeManager.on('connect', (node: any) => {
        logger.info(`Node "${node.id}" connected`);
    });

    (client.lavalink as any).nodeManager.on('error', (node: any, error: any) => {
        logger.error(`Node "${node.id}" error:`, error.message);
    });

    // Sets node.sessionId before updateSession() can throw "not ready" on it.
    (client.lavalink as any).nodeManager.on('raw', (node: any, payload: any) => {
        if (payload?.op !== 'ready') return;

        node.sessionId = payload.sessionId;
        node.updateSession(true, RESUME_TIMEOUT_MS).catch((err: unknown) =>
            logger.error(`Failed to enable resuming on node "${node.id}":`, err)
        );
        saveSessionId(node.id, payload.sessionId).catch((err: unknown) =>
            logger.error(`Failed to persist sessionId for node "${node.id}":`, err)
        );
    });

    // Fires after a resumed WS reconnect (e.g. a `--bot` restart within RESUME_TIMEOUT_MS) with the players Lavalink kept alive.
    (client.lavalink as any).nodeManager.on('resumed', async (node: any, _payload: unknown, lavalinkPlayers: any[]) => {
        logger.info(`Node "${node.id}" resumed with ${lavalinkPlayers.length} player(s).`);

        for (const lavalinkPlayer of lavalinkPlayers) {
            const saved = await getMusicPlayer(lavalinkPlayer.guildId);
            if (!saved || !lavalinkPlayer.state.connected) {
                if (saved) await deleteMusicPlayer(lavalinkPlayer.guildId);
                continue;
            }

            try {
                const player = client.lavalink.createPlayer({
                    guildId: lavalinkPlayer.guildId,
                    voiceChannelId: saved.voiceChannelId,
                    textChannelId: saved.textChannelId,
                    node: node.id,
                    volume: lavalinkPlayer.volume,
                    selfDeaf: saved.selfDeaf,
                    selfMute: saved.selfMute,
                });

                await player.connect();

                player.paused = lavalinkPlayer.paused;
                player.lastPosition = lavalinkPlayer.state.position;
                player.filterManager.data = lavalinkPlayer.filters;

                await player.queue.utils.sync(true, false);

                if (lavalinkPlayer.track) {
                    player.queue.current = client.lavalink.utils.buildTrack(lavalinkPlayer.track, saved.requesterId);
                }

                logger.info(`Restored player for guild "${lavalinkPlayer.guildId}".`);
            } catch (err) {
                logger.error(`Failed to restore player for guild "${lavalinkPlayer.guildId}":`, err);
            }
        }
    });

    client.lavalink.on('trackStart', (player, track) => {
        const channel = client.channels.cache.get(player.textChannelId as string) as TextBasedChannel | undefined;
        if (channel && 'send' in channel) channel.send(`Now playing: **${track?.info.title}** by **${track?.info.author}**`);

        saveMusicPlayer(
            player.guildId,
            player.node.id,
            player.voiceChannelId as string,
            player.textChannelId as string,
            player.options.selfDeaf ?? true,
            player.options.selfMute ?? false,
            (track?.requester as { id?: string } | undefined)?.id ?? null
        ).catch((err) => logger.error(`Failed to persist player state for guild "${player.guildId}":`, err));
    });

    client.lavalink.on('queueEnd', (player) => {
        if (player.getData('manual_stop')) return;
        const channel = client.channels.cache.get(player.textChannelId as string) as TextBasedChannel | undefined;
        if (channel && 'send' in channel) channel.send('Queue finished. Leaving voice channel in 30 seconds.');
    });

    client.lavalink.on('playerDestroy', (player) => {
        const channel = client.channels.cache.get(player.textChannelId as string) as TextBasedChannel | undefined;
        if (channel && 'send' in channel) channel.send('Left the voice channel.').catch(() => {});

        deleteMusicPlayer(player.guildId).catch((err) => logger.error(`Failed to remove persisted player state for guild "${player.guildId}":`, err));
    });
};
