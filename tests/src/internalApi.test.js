const http = require('node:http');
const mongoose = require('mongoose');

jest.mock('../../slashCommands/utility/giveaway', () => ({ endGiveaway: jest.fn() }));
jest.mock('../../models/GiveawaySchema', () => ({ findOne: jest.fn() }));

function request(port, path, options = {}) {
    return new Promise((resolve, reject) => {
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
    let server, port, client;

    beforeAll(done => {
        process.env.INTERNAL_API_PORT = '0';
        client = { isReady: jest.fn() };

        // Force the server onto an ephemeral port so tests don't collide, and capture the instance/port once bound.
        const originalListen = http.Server.prototype.listen;
        http.Server.prototype.listen = function (_port, host, cb) {
            server = this;
            return originalListen.call(this, 0, host, () => {
                port = this.address().port;
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
        expect(res.body).toEqual({ discord: 'up', mongo: 'up' });
    });

    test('returns 503 when discord client is not ready', async () => {
        client.isReady.mockReturnValue(false);
        mongoose.connection.readyState = 1;

        const res = await request(port, '/internal/health');

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ discord: 'down', mongo: 'up' });
    });

    test('returns 503 when mongo is not connected', async () => {
        client.isReady.mockReturnValue(true);
        mongoose.connection.readyState = 0;

        const res = await request(port, '/internal/health');

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ discord: 'up', mongo: 'down' });
    });

    test('does not require the internal secret header', async () => {
        client.isReady.mockReturnValue(true);
        mongoose.connection.readyState = 1;

        const res = await request(port, '/internal/health', { headers: {} });

        expect(res.status).toBe(200);
    });
});
