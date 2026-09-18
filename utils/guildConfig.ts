import GuildSchema from '../models/GuildSchema';

// Short TTL cache: guild config changes rarely but is read on nearly every event.
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
