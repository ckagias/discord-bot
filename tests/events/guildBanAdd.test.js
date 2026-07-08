jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn() }));

const { getLogChannel } = require('../../utils/logger');
const guildBanAdd = require('../../events/guildBanAdd');

function makeBan(overrides = {}) {
    return {
        guild: { fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }) },
        user: { id: 'user1', username: 'Target', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/a.png') },
        reason: null,
        ...overrides,
    };
}

describe('guildBanAdd', () => {
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

        const promise = guildBanAdd.execute(ban);
        await jest.runAllTimersAsync();
        await promise;

        expect(ban.guild.fetchAuditLogs).not.toHaveBeenCalled();
    });

    test('logs the ban with a default reason and unknown moderator when no audit entry matches', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const ban = makeBan();

        const promise = guildBanAdd.execute(ban);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('attributes the ban to the moderator found in the audit log', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const ban = makeBan({
            guild: {
                fetchAuditLogs: jest.fn().mockResolvedValue({
                    entries: { first: () => ({ target: { id: 'user1' }, executor: { username: 'Mod', id: 'mod1' }, reason: 'spamming' }) },
                }),
            },
        });

        const promise = guildBanAdd.execute(ban);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('ignores an audit entry for a different user', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const ban = makeBan({
            guild: {
                fetchAuditLogs: jest.fn().mockResolvedValue({
                    entries: { first: () => ({ target: { id: 'someoneElse' }, executor: { username: 'Mod', id: 'mod1' } }) },
                }),
            },
        });

        const promise = guildBanAdd.execute(ban);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalled();
    });

    test('continues without throwing when the audit log fetch fails', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const ban = makeBan({ guild: { fetchAuditLogs: jest.fn().mockRejectedValue(new Error('no perms')) } });

        const promise = guildBanAdd.execute(ban);
        await jest.runAllTimersAsync();
        await expect(promise).resolves.not.toThrow();
        expect(logChannel.send).toHaveBeenCalled();
    });

    test('does not throw when sending the log message fails', async () => {
        const logChannel = { send: jest.fn().mockRejectedValue(new Error('missing perms')) };
        getLogChannel.mockResolvedValue(logChannel);
        const ban = makeBan();

        const promise = guildBanAdd.execute(ban);
        await jest.runAllTimersAsync();
        await expect(promise).resolves.not.toThrow();
    });
});
