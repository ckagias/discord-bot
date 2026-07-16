import { Model, QueryFilter, UpdateQuery, QueryOptions } from 'mongoose';

// Two concurrent findOneAndUpdate upserts targeting a not-yet-existing document can both
// attempt the insert; the loser gets a duplicate-key error (11000) instead of an update.
// Retrying without upsert picks up the winner's freshly-inserted document.
async function upsertWithRetry(model: Model<any>, filter: QueryFilter<any>, update: UpdateQuery<any>, options: QueryOptions = {}) {
    try {
        return await model.findOneAndUpdate(filter, update, { ...options, upsert: true });
    } catch (err: any) {
        if (err.code !== 11000) throw err;
        return model.findOneAndUpdate(filter, update, { ...options, upsert: false });
    }
}

export { upsertWithRetry };
