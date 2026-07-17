import CaseSchema from '../models/CaseSchema';

// Deleting the highest-numbered case frees its number; on conflict, recompute and retry rather than crash.
const MAX_ATTEMPTS = 5;

interface CreateCaseInput {
    guildId: string;
    type: string;
    userId: string;
    moderatorId: string;
    reason: string;
    duration?: string | null;
}

async function createCase({ guildId, type, userId, moderatorId, reason, duration = null }: CreateCaseInput) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const last = await CaseSchema.findOne({ guildId }).sort({ caseId: -1 });
        const caseId = (last?.caseId ?? 0) + 1;

        try {
            return await CaseSchema.create({ guildId, caseId, type, userId, moderatorId, reason, duration });
        } catch (err: any) {
            if (err.code !== 11000) throw err;
        }
    }

    throw new Error(`Failed to allocate a case number for guild ${guildId} after ${MAX_ATTEMPTS} attempts.`);
}

export { createCase };
