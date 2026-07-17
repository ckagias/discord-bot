import { Model, QueryFilter, UpdateQuery, QueryOptions } from 'mongoose';

// On a concurrent-insert race the loser gets error 11000; retry without upsert to pick up the winner's doc.
async function upsertWithRetry(model: Model<any>, filter: QueryFilter<any>, update: UpdateQuery<any>, options: QueryOptions = {}) {
    try {
        return await model.findOneAndUpdate(filter, update, { ...options, upsert: true });
    } catch (err: any) {
        if (err.code !== 11000) throw err;
        return model.findOneAndUpdate(filter, update, { ...options, upsert: false });
    }
}

export { upsertWithRetry };
