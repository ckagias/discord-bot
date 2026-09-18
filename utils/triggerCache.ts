const TriggerSchema = require('../models/TriggerSchema');

// Short TTL cache: trigger lists change rarely but are read on every non-bot message.
type Trigger = { trigger: string; response: string };

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: Trigger[]; expiresAt: number }>();

function getTriggers(guildId: string): Promise<Trigger[]> {
    const cached = cache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);

    return TriggerSchema.find({ guildId }).lean().then((value: Trigger[]) => {
        cache.set(guildId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        return value;
    });
}

function invalidateTriggers(guildId: string) {
    cache.delete(guildId);
}

export { getTriggers, invalidateTriggers };
