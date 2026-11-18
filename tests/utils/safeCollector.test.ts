const mockError = jest.fn();
jest.mock('../../utils/log', () => ({ scope: () => ({ error: mockError }) }));

const { safeCollector } = require('../../utils/safeCollector');

function makeCollector() {
    const handlers: Record<string, (...args: any[]) => any> = {};
    return { on: jest.fn((event: string, fn: (...args: any[]) => any) => { handlers[event] = fn; }), handlers };
}

describe('safeCollector', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('registers the collect and end handlers and returns the collector', () => {
        const collector = makeCollector();

        const result = safeCollector(collector, { onCollect: jest.fn(), onEnd: jest.fn() });

        expect(result).toBe(collector);
        expect(collector.on).toHaveBeenCalledWith('collect', expect.any(Function));
        expect(collector.on).toHaveBeenCalledWith('end', expect.any(Function));
    });

    test('only registers the handlers it was given', () => {
        const collector = makeCollector();

        safeCollector(collector, { onEnd: jest.fn() });

        expect(collector.on).toHaveBeenCalledTimes(1);
        expect(collector.on).toHaveBeenCalledWith('end', expect.any(Function));
    });

    test('passes the collected interaction, collection and reason through', async () => {
        const collector = makeCollector();
        const onCollect = jest.fn();
        const onEnd = jest.fn();
        safeCollector(collector, { onCollect, onEnd });
        const interaction = { customId: 'x' };
        const collected = new Map();

        await collector.handlers.collect(interaction);
        await collector.handlers.end(collected, 'time');

        expect(onCollect).toHaveBeenCalledWith(interaction);
        expect(onEnd).toHaveBeenCalledWith(collected, 'time');
    });

    test('waits for an async handler to finish', async () => {
        const collector = makeCollector();
        const order: string[] = [];
        safeCollector(collector, {
            onCollect: async () => {
                await Promise.resolve();
                order.push('handler done');
            },
        });

        await collector.handlers.collect({});
        order.push('wrapper done');

        expect(order).toEqual(['handler done', 'wrapper done']);
    });

    test('logs a rejecting collect handler instead of letting it escape', async () => {
        const collector = makeCollector();
        const error = new Error('Unknown Message');
        safeCollector(collector, { onCollect: jest.fn().mockRejectedValue(error) }, 'gamble');

        await expect(collector.handlers.collect({})).resolves.toBeUndefined();

        expect(mockError).toHaveBeenCalledWith('gamble: error in collect handler:', error);
    });

    test('logs a rejecting end handler instead of letting it escape', async () => {
        const collector = makeCollector();
        const error = new Error('Unknown Interaction');
        safeCollector(collector, { onEnd: jest.fn().mockRejectedValue(error) }, 'rps');

        await expect(collector.handlers.end(new Map(), 'time')).resolves.toBeUndefined();

        expect(mockError).toHaveBeenCalledWith('rps: error in end handler:', error);
    });

    test('logs a handler that throws synchronously', async () => {
        const collector = makeCollector();
        const error = new Error('boom');
        safeCollector(collector, {
            onCollect: () => { throw error; },
            onEnd: () => { throw error; },
        });

        await expect(collector.handlers.collect({})).resolves.toBeUndefined();
        await expect(collector.handlers.end(new Map(), 'time')).resolves.toBeUndefined();

        expect(mockError).toHaveBeenCalledTimes(2);
    });

    test('a failing handler does not stop later events from being handled', async () => {
        const collector = makeCollector();
        const onCollect = jest.fn().mockRejectedValueOnce(new Error('first fails')).mockResolvedValueOnce(undefined);
        safeCollector(collector, { onCollect });

        await collector.handlers.collect({ n: 1 });
        await collector.handlers.collect({ n: 2 });

        expect(onCollect).toHaveBeenCalledTimes(2);
        expect(mockError).toHaveBeenCalledTimes(1);
    });
});
