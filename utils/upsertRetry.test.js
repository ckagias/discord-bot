const { upsertWithRetry } = require('./upsertRetry');

function duplicateKeyError() {
    const err = new Error('E11000 duplicate key error');
    err.code = 11000;
    return err;
}

describe('upsertWithRetry', () => {
    test('returns the result of the upsert when it succeeds', async () => {
        const model = { findOneAndUpdate: jest.fn().mockResolvedValue({ xp: 10 }) };

        const result = await upsertWithRetry(model, { userId: '1' }, { $inc: { xp: 10 } });

        expect(result).toEqual({ xp: 10 });
        expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(model.findOneAndUpdate).toHaveBeenCalledWith({ userId: '1' }, { $inc: { xp: 10 } }, { upsert: true });
    });

    test('retries as a plain update when the upsert insert loses a race (E11000)', async () => {
        const model = {
            findOneAndUpdate: jest.fn()
                .mockRejectedValueOnce(duplicateKeyError())
                .mockResolvedValueOnce({ xp: 25 }),
        };

        const result = await upsertWithRetry(model, { userId: '1' }, { $inc: { xp: 10 } }, { returnDocument: 'after' });

        expect(result).toEqual({ xp: 25 });
        expect(model.findOneAndUpdate).toHaveBeenCalledTimes(2);
        expect(model.findOneAndUpdate).toHaveBeenNthCalledWith(1, { userId: '1' }, { $inc: { xp: 10 } }, { returnDocument: 'after', upsert: true });
        expect(model.findOneAndUpdate).toHaveBeenNthCalledWith(2, { userId: '1' }, { $inc: { xp: 10 } }, { returnDocument: 'after', upsert: false });
    });

    test('rethrows errors that are not a duplicate-key conflict', async () => {
        const otherError = new Error('connection lost');
        const model = { findOneAndUpdate: jest.fn().mockRejectedValue(otherError) };

        await expect(upsertWithRetry(model, { userId: '1' }, {})).rejects.toThrow('connection lost');
        expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });
});
