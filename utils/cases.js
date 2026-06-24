const CaseSchema = require('../models/CaseSchema');

async function createCase({ guildId, type, userId, moderatorId, reason, duration = null }) {
    const last = await CaseSchema.findOne({ guildId }).sort({ caseId: -1 }).select('caseId').lean();
    const caseId = (last?.caseId ?? 0) + 1;
    return CaseSchema.create({ guildId, caseId, type, userId, moderatorId, reason, duration });
}

module.exports = { createCase };
