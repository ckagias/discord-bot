import http from 'node:http';
const mongoose = require('mongoose');

jest.mock('../../slashCommands/utility/giveaway', () => ({ endGiveaway: jest.fn() }));
jest.mock('../../models/GiveawaySchema', () => ({ findOne: jest.fn() }));

function request(port: number, path: string, options: { method?: string; headers?: Record<string, string> } = {}) {
    return new Promise<{ status: number | undefined; body: any }>((resolve, reject) => {
        const req = http.request({ port, path, method: options.method || 'GET', headers: options.headers }, res => {
            let body = '';
            res.on('data', chunk => (body += chunk));
            res.on('end', () => resolve({ status: res.statusCode, body: body ? JSON.parse(body) : undefined }));
        });
        req.on('error', reject);
        req.end();
    });
}

describe('internal API /internal/health', () => {
    let server: http.Server | undefined, port: number, client: { isReady: jest.Mock; ws: { ping: number }; uptime: number };

    beforeAll(done => {
        process.env.INTERNAL_API_PORT = '0';
        client = { isReady: jest.fn(), ws: { ping: 42 }, uptime: 12345 };

        // Force the server onto an ephemeral port so tests don't collide, and capture the instance/port once bound, handling both listen(port, cb) and listen(port, host, cb).
        const originalListen = http.Server.prototype.listen;
        (http.Server.prototype.listen as any) = function (this: http.Server, _port: number, hostOrCb?: any, maybeCb?: any) {
            const cb = typeof hostOrCb === 'function' ? hostOrCb : maybeCb;
            // eslint-disable-next-line @typescript-eslint/no-this-alias -- need to capture the server instance for later assertions/cleanup
            server = this;
            return (originalListen as any).call(this, 0, () => {
                port = ((server as http.Server).address() as any).port;
                http.Server.prototype.listen = originalListen;
                cb();
                done();
            });
        };

        const startInternalApi = require('../../src/internalApi');
        startInternalApi(client);
    });

    afterAll(() => {
        server?.close();
    });

    test('returns 200 when discord and mongo are both up', async () => {
        client.isReady.mockReturnValue(true);
        mongoose.connection.readyState = 1;

        const res = await request(port, '/internal/health');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ discord: 'up', mongo: 'up', ping: 42, uptime: 12345 });
    });

    test('returns 503 when discord client is not ready', async () => {
        client.isReady.mockReturnValue(false);
        mongoose.connection.readyState = 1;

        const res = await request(port, '/internal/health');

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ discord: 'down', mongo: 'up', ping: null, uptime: null });
    });

    test('returns 503 when mongo is not connected', async () => {
        client.isReady.mockReturnValue(true);
        mongoose.connection.readyState = 0;

        const res = await request(port, '/internal/health');

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ discord: 'up', mongo: 'down', ping: 42, uptime: 12345 });
    });

    test('does not require the internal secret header', async () => {
        client.isReady.mockReturnValue(true);
        mongoose.connection.readyState = 1;

        const res = await request(port, '/internal/health', { headers: {} });

        expect(res.status).toBe(200);
    });
});
