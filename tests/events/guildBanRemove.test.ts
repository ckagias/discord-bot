jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn() }));
jest.mock('../../utils/punishments', () => ({ cancelPunishments: jest.fn() }));

const { getLogChannel } = require('../../utils/logger');
const { cancelPunishments } = require('../../utils/punishments');
const guildBanRemove = require('../../events/guildBanRemove');

function makeBan(overrides = {}) {
    return {
        guild: {
            id: 'g1',
            fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }),
            bans: { fetch: jest.fn().mockRejectedValue({ code: 10026 }) }, // not banned any more
        },
        user: { id: 'user1', username: 'Target', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/a.png') },
        ...overrides,
    };
}

describe('guildBanRemove', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('does nothing when no log channel is configured', async () => {
        getLogChannel.mockResolvedValue(null);
        const ban = makeBan();

        const promise = guildBanRemove.execute(ban);
        await jest.runAllTimersAsync();
        await promise;

        expect(ban.guild.fetchAuditLogs).not.toHaveBeenCalled();
    });

    test('logs the unban with an unknown moderator when no audit entry matches', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const ban = makeBan();

        const promise = guildBanRemove.execute(ban);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('attributes the unban to the moderator found in the audit log', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const ban = makeBan({
            guild: {
                id: 'g1',
                bans: { fetch: jest.fn().mockRejectedValue({ code: 10026 }) },
                fetchAuditLogs: jest.fn().mockResolvedValue({
                    entries: { first: () => ({ target: { id: 'user1' }, executor: { username: 'Mod', id: 'mod1' } }) },
                }),
            },
        });

        const promise = guildBanRemove.execute(ban);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalled();
    });

    test('continues without throwing when the audit log fetch fails', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const ban = makeBan({ guild: { id: 'g1', bans: { fetch: jest.fn().mockRejectedValue({ code: 10026 }) }, fetchAuditLogs: jest.fn().mockRejectedValue(new Error('no perms')) } });

        const promise = guildBanRemove.execute(ban);
        await jest.runAllTimersAsync();
        await expect(promise).resolves.not.toThrow();
    });

    describe('pending timed ban', () => {
        async function run(ban: ReturnType<typeof makeBan>) {
            const promise = guildBanRemove.execute(ban);
            await jest.runAllTimersAsync();
            await promise;
        }

        test('is cancelled when the user is confirmed not banned, even with no log channel', async () => {
            getLogChannel.mockResolvedValue(null);
            const ban = makeBan();

            await run(ban);

            expect(ban.guild.bans.fetch).toHaveBeenCalledWith({ user: 'user1', force: true });
            expect(cancelPunishments).toHaveBeenCalledWith('g1', 'user1', 'ban');
        });

        test('is kept when the user has been banned again by the time the event is handled', async () => {
            getLogChannel.mockResolvedValue(null);
            const ban = makeBan();
            ban.guild.bans.fetch.mockResolvedValue({ user: { id: 'user1' } });

            await run(ban);

            expect(cancelPunishments).not.toHaveBeenCalled();
        });

        test('is kept when the ban lookup fails for another reason', async () => {
            getLogChannel.mockResolvedValue(null);
            const ban = makeBan();
            ban.guild.bans.fetch.mockRejectedValue({ code: 500 });

            await run(ban);

            expect(cancelPunishments).not.toHaveBeenCalled();
        });
    });
});
