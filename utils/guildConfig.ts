import GuildSchema from '../models/GuildSchema';

function getGuildConfig(guildId: string) {
    return GuildSchema.findOne({ guildId });
}

function ensureGuildConfig(guildId: string) {
    return GuildSchema.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        { upsert: true, returnDocument: 'after' }
    );
}

function updateGuildConfig(guildId: string, fields: Record<string, unknown>) {
    return GuildSchema.findOneAndUpdate(
        { guildId },
        { $set: fields, $setOnInsert: { guildId } },
        { upsert: true }
    );
}

export { getGuildConfig, ensureGuildConfig, updateGuildConfig };
