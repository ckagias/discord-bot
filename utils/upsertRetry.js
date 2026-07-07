// Two concurrent findOneAndUpdate upserts targeting a not-yet-existing document can both
// attempt the insert; the loser gets a duplicate-key error (11000) instead of an update.
// Retrying without upsert picks up the winner's freshly-inserted document.
async function upsertWithRetry(model, filter, update, options = {}) {
    try {
        return await model.findOneAndUpdate(filter, update, { ...options, upsert: true });
    } catch (err) {
        if (err.code !== 11000) throw err;
        return model.findOneAndUpdate(filter, update, { ...options, upsert: false });
    }
}

module.exports = { upsertWithRetry };
