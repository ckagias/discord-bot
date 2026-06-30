const CaseSchema = require('../models/CaseSchema');
const GuildSchema = require('../models/GuildSchema');

async function createCase({ guildId, type, userId, moderatorId, reason, duration = null }) {
    const guild = await GuildSchema.findOneAndUpdate(
        { guildId },
        { $inc: { caseCounter: 1 } },
        { new: true, upsert: true },
    );
    const caseId = guild.caseCounter;
    return CaseSchema.create({ guildId, caseId, type, userId, moderatorId, reason, duration });
}

module.exports = { createCase };
