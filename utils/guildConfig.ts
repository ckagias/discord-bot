import GuildSchema from '../models/GuildSchema';

// Guild config changes rarely (settings commands) but is read on nearly every event (messages, voice
// states, member updates), so a short TTL cache avoids a DB round-trip per event without risking
// serving stale data for long after a config change.
type GuildConfig = Awaited<ReturnType<typeof GuildSchema.findOne>>;

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: GuildConfig; expiresAt: number }>();

function getGuildConfig(guildId: string) {
    const cached = cache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);

    return GuildSchema.findOne({ guildId }).then((value) => {
        cache.set(guildId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        return value;
    });
}

function invalidateGuildConfig(guildId: string) {
    cache.delete(guildId);
}

async function ensureGuildConfig(guildId: string) {
    const config = await GuildSchema.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        { upsert: true, returnDocument: 'after' }
    );
    invalidateGuildConfig(guildId);
    return config;
}

async function updateGuildConfig(guildId: string, fields: Record<string, unknown>) {
    const result = await GuildSchema.findOneAndUpdate(
        { guildId },
        { $set: fields, $setOnInsert: { guildId } },
        { upsert: true }
    );
    invalidateGuildConfig(guildId);
    return result;
}

export { getGuildConfig, ensureGuildConfig, updateGuildConfig, invalidateGuildConfig };
