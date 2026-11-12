import http from 'node:http';

jest.mock('../../slashCommands/utility/giveaway', () => ({ endGiveaway: jest.fn() }));
jest.mock('../../models/GiveawaySchema', () => ({ findOne: jest.fn() }));

function post(port: number, body: unknown, headers: Record<string, string> = { 'x-internal-secret': 'correct-secret' }) {
    return new Promise<{ status: number | undefined; body: any }>((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request(
            { port, path: '/internal/role/validate', method: 'POST', headers: { 'content-type': 'application/json', ...headers } },
            res => {
                let text = '';
                res.on('data', chunk => (text += chunk));
                res.on('end', () => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : undefined }));
            }
        );
        req.on('error', reject);
        req.end(payload);
    });
}

// This route is rate limited to 10 requests per window, so the file stays within that.
describe('internal API /internal/role/validate', () => {
    let server: http.Server | undefined, port: number;
    const guild: any = {
        ownerId: 'owner',
        members: { fetch: jest.fn() },
        roles: { cache: { get: jest.fn() }, fetch: jest.fn() },
    };
    const client = { isReady: jest.fn().mockReturnValue(true), guilds: { fetch: jest.fn() } };

    beforeAll(done => {
        process.env.INTERNAL_API_PORT = '0';
        process.env.INTERNAL_API_SECRET = 'correct-secret';

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

        jest.isolateModules(() => {
            const startInternalApi = require('../../src/internalApi');
            startInternalApi(client);
        });
    });

    afterAll(() => {
        server?.close();
        delete process.env.INTERNAL_API_SECRET;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        client.guilds.fetch.mockResolvedValue(guild);
        guild.members.fetch.mockResolvedValue({ roles: { highest: { position: 5 } } });
        guild.roles.cache.get.mockImplementation((id: string) => ({ low: { id: 'low', name: 'Low', position: 2 }, same: { id: 'same', name: 'Same', position: 5 }, high: { id: 'high', name: 'Admin', position: 9 } } as any)[id]);
        guild.roles.fetch.mockResolvedValue(null);
    });

    test('requires the internal secret', async () => {
        const res = await post(port, { guildId: 'g1', userId: 'u1', roleIds: ['low'] }, {});

        expect(res.status).toBe(401);
    });

    test('rejects a request with missing or malformed fields', async () => {
        expect((await post(port, { guildId: 'g1', roleIds: ['low'] })).status).toBe(400);
        expect((await post(port, { guildId: 'g1', userId: 'u1', roleIds: [{ $ne: null }] })).status).toBe(400);
    });

    test('returns 404 when the bot is not in the guild', async () => {
        client.guilds.fetch.mockRejectedValue(new Error('Unknown Guild'));

        const res = await post(port, { guildId: 'g1', userId: 'u1', roleIds: ['low'] });

        expect(res.status).toBe(404);
    });

    test('refuses a user who is not a member of the server', async () => {
        guild.members.fetch.mockRejectedValue(new Error('Unknown Member'));

        const res = await post(port, { guildId: 'g1', userId: 'u1', roleIds: ['low'] });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('not a member');
    });

    test('allows roles below the user\'s highest role, including one that has to be fetched', async () => {
        guild.roles.fetch.mockResolvedValue({ id: 'uncached', name: 'Uncached', position: 1 });

        const res = await post(port, { guildId: 'g1', userId: 'u1', roleIds: ['low', 'uncached'] });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
        expect(guild.members.fetch).toHaveBeenCalledWith('u1');
    });

    test('refuses a role at the same position as the user\'s highest role, naming it', async () => {
        const res = await post(port, { guildId: 'g1', userId: 'u1', roleIds: ['same'] });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('"Same"');
    });

    test('refuses the whole request when any one role is too high', async () => {
        const res = await post(port, { guildId: 'g1', userId: 'u1', roleIds: ['low', 'high'] });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('"Admin"');
    });

    test('lets the server owner use any role', async () => {
        guild.members.fetch.mockResolvedValue({ roles: { highest: { position: 0 } } });

        const res = await post(port, { guildId: 'g1', userId: 'owner', roleIds: ['high'] });

        expect(res.status).toBe(200);
    });

    test('returns 400 for a role that does not exist', async () => {
        const res = await post(port, { guildId: 'g1', userId: 'u1', roleIds: ['nope'] });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('nope');
    });

    test('accepts an empty list of roles', async () => {
        const res = await post(port, { guildId: 'g1', userId: 'u1', roleIds: [] });

        expect(res.status).toBe(200);
    });
});
