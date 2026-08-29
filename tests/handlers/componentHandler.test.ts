jest.mock('fs');

const { resolveComponent } = require('../../handlers/componentHandler');

function makeClient(components: any) {
    return { components } as any;
}

function loadComponentHandler(files: Record<string, any>) {
    const fs = require('fs');
    fs.readdirSync.mockReturnValue(Object.keys(files));
    jest.doMock('path', () => {
        const actual = jest.requireActual('path');
        return { ...actual, join: (...parts: string[]) => parts[parts.length - 1] };
    });
    for (const [file, mod] of Object.entries(files)) {
        jest.doMock(file, () => mod, { virtual: true });
    }
    return require('../../handlers/componentHandler');
}

describe('resolveComponent', () => {
    test('returns null when the client has no components registered', () => {
        const client = makeClient(undefined);
        expect(resolveComponent(client, 'button', 'anything')).toBeNull();
    });

    test('resolves an exact id match', () => {
        const execute = jest.fn();
        const client = makeClient({
            button: { byId: new Map([['confirm', execute]]), prefixes: [] },
        });

        expect(resolveComponent(client, 'button', 'confirm')).toBe(execute);
    });

    test('resolves a prefix match when there is no exact id match', () => {
        const execute = jest.fn();
        const client = makeClient({
            button: { byId: new Map(), prefixes: [['giveaway_enter_', execute]] },
        });

        expect(resolveComponent(client, 'button', 'giveaway_enter_12345')).toBe(execute);
    });

    test('prefers an exact id match over a prefix match', () => {
        const exact = jest.fn();
        const prefixed = jest.fn();
        const client = makeClient({
            button: { byId: new Map([['ticket_close_', exact]]), prefixes: [['ticket_', prefixed]] },
        });

        expect(resolveComponent(client, 'button', 'ticket_close_')).toBe(exact);
    });

    test('returns null when no id or prefix matches', () => {
        const client = makeClient({
            button: { byId: new Map([['confirm', jest.fn()]]), prefixes: [['giveaway_', jest.fn()]] },
        });

        expect(resolveComponent(client, 'button', 'unknown_button')).toBeNull();
    });

    test('checks buckets independently by type', () => {
        const buttonHandler = jest.fn();
        const client = makeClient({
            button: { byId: new Map([['shared_id', buttonHandler]]), prefixes: [] },
            modal: { byId: new Map(), prefixes: [] },
        });

        expect(resolveComponent(client, 'modal', 'shared_id')).toBeNull();
        expect(resolveComponent(client, 'button', 'shared_id')).toBe(buttonHandler);
    });
});

describe('registerComponents', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.resetModules();
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    test('registers a component by exact id', () => {
        const execute = jest.fn();
        const registerComponents = loadComponentHandler({
            'confirm.js': { type: 'button', id: 'confirm', execute },
        });
        const client: any = {};

        registerComponents(client);

        expect(client.components.button.byId.get('confirm')).toBe(execute);
    });

    test('registers a component by prefix', () => {
        const execute = jest.fn();
        const registerComponents = loadComponentHandler({
            'giveaway.js': { type: 'button', prefix: 'giveaway_enter_', execute },
        });
        const client: any = {};

        registerComponents(client);

        expect(client.components.button.prefixes).toContainEqual(['giveaway_enter_', execute]);
    });

    test('registers every entry when a file exports an array', () => {
        const executeA = jest.fn();
        const executeB = jest.fn();
        const registerComponents = loadComponentHandler({
            'multi.js': [
                { type: 'button', id: 'a', execute: executeA },
                { type: 'modal', id: 'b', execute: executeB },
            ],
        });
        const client: any = {};

        registerComponents(client);

        expect(client.components.button.byId.get('a')).toBe(executeA);
        expect(client.components.modal.byId.get('b')).toBe(executeB);
    });

    test('warns and skips an entry with an unknown type', () => {
        const registerComponents = loadComponentHandler({
            'bad.js': { type: 'select', id: 'x', execute: jest.fn() },
        });
        const client: any = {};

        registerComponents(client);

        expect(warnSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('unknown type "select"'));
        expect(client.components.button.byId.size).toBe(0);
        expect(client.components.modal.byId.size).toBe(0);
    });

    test('warns and skips an entry missing both id and prefix', () => {
        const registerComponents = loadComponentHandler({
            'bad.js': { type: 'button', execute: jest.fn() },
        });
        const client: any = {};

        registerComponents(client);

        expect(warnSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('missing both "id" and "prefix"'));
        expect(client.components.button.byId.size).toBe(0);
        expect(client.components.button.prefixes).toHaveLength(0);
    });
});
