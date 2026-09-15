import type { QueueStoreManager, StoredQueue } from 'lavalink-client' with { 'resolution-mode': 'import' };
import MusicQueueSchema from '../models/MusicQueueSchema';
import MusicPlayerSchema from '../models/MusicPlayerSchema';
import LavalinkSessionSchema from '../models/LavalinkSessionSchema';
import { upsertWithRetry } from './upsertRetry';

// Mongo-backed queueStore so lavalink-client's own save/sync calls persist queues across bot restarts.
const mongoQueueStore: QueueStoreManager = {
    async get(guildId) {
        const doc = await MusicQueueSchema.findOne({ guildId });
        return doc?.data;
    },
    async set(guildId, value) {
        await upsertWithRetry(
            MusicQueueSchema,
            { guildId },
            { $set: { data: value as string }, $setOnInsert: { guildId } }
        );
    },
    async delete(guildId) {
        await MusicQueueSchema.deleteOne({ guildId });
    },
    stringify(value) {
        return JSON.stringify(value);
    },
    parse(value) {
        return JSON.parse(value as string) as Partial<StoredQueue>;
    },
};

// voiceChannelId/textChannelId aren't part of Lavalink's own player state, so they're tracked separately per guild.
async function saveMusicPlayer(guildId: string, nodeId: string, voiceChannelId: string, textChannelId: string, selfDeaf: boolean, selfMute: boolean, requesterId: string | null) {
    await upsertWithRetry(
        MusicPlayerSchema,
        { guildId },
        { $set: { nodeId, voiceChannelId, textChannelId, selfDeaf, selfMute, requesterId }, $setOnInsert: { guildId } }
    );
}

async function deleteMusicPlayer(guildId: string) {
    await MusicPlayerSchema.deleteOne({ guildId });
}

async function getMusicPlayer(guildId: string) {
    return MusicPlayerSchema.findOne({ guildId });
}

async function getSavedSessionId(nodeId: string) {
    const doc = await LavalinkSessionSchema.findOne({ nodeId });
    return doc?.sessionId;
}

async function saveSessionId(nodeId: string, sessionId: string) {
    await upsertWithRetry(
        LavalinkSessionSchema,
        { nodeId },
        { $set: { sessionId }, $setOnInsert: { nodeId } }
    );
}

export { mongoQueueStore, saveMusicPlayer, deleteMusicPlayer, getMusicPlayer, getSavedSessionId, saveSessionId };
