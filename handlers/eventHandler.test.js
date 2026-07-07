jest.mock('fs');

function makeClient() {
    const listeners = {};
    return {
        listeners,
        once: jest.fn((name, fn) => { listeners[name] = fn; }),
        on: jest.fn((name, fn) => { listeners[name] = fn; }),
    };
}

function loadEventHandler(files) {
    const fs = require('fs');
    fs.readdirSync.mockReturnValue(Object.keys(files));
    jest.doMock('path', () => {
        const actual = jest.requireActual('path');
        return { ...actual, join: (...parts) => parts[parts.length - 1] };
    });
    for (const [file, mod] of Object.entries(files)) {
        jest.doMock(file, () => mod, { virtual: true });
    }
    return require('./eventHandler');
}

describe('eventHandler', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.resetModules();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    test('a synchronous throw in one event does not crash the process or block registration', async () => {
        const registerEvents = loadEventHandler({
            'bad.js': { name: 'bad', execute: () => { throw new Error('boom'); } },
        });
        const client = makeClient();

        registerEvents(client);
        await client.listeners.bad();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[ERROR] [eventHandler]'),
            'Unhandled error in bad:',
            expect.any(Error)
        );
    });

    test('a rejected promise from an async event is caught, not left unhandled', async () => {
        const registerEvents = loadEventHandler({
            'bad.js': { name: 'bad', execute: async () => { throw new Error('async boom'); } },
        });
        const client = makeClient();

        registerEvents(client);
        await client.listeners.bad();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[ERROR] [eventHandler]'),
            'Unhandled error in bad:',
            expect.any(Error)
        );
    });

    test('one event throwing does not stop other registered events from firing', async () => {
        const goodExecute = jest.fn();
        const registerEvents = loadEventHandler({
            'bad.js': { name: 'bad', execute: () => { throw new Error('boom'); } },
            'good.js': { name: 'good', execute: goodExecute },
        });
        const client = makeClient();

        registerEvents(client);
        await client.listeners.bad();
        await client.listeners.good();

        expect(goodExecute).toHaveBeenCalledTimes(1);
    });

    test('once-events are registered via client.once, not client.on', () => {
        const registerEvents = loadEventHandler({
            'ready.js': { name: 'ready', once: true, execute: jest.fn() },
        });
        const client = makeClient();

        registerEvents(client);

        expect(client.once).toHaveBeenCalledWith('ready', expect.any(Function));
        expect(client.on).not.toHaveBeenCalled();
    });
});
