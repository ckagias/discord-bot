jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn() }));

const { getLogChannel } = require('../../utils/logger');
const guildBanRemove = require('../../events/guildBanRemove');

function makeBan(overrides = {}) {
    return {
        guild: { fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }) },
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
        const ban = makeBan({ guild: { fetchAuditLogs: jest.fn().mockRejectedValue(new Error('no perms')) } });

        const promise = guildBanRemove.execute(ban);
        await jest.runAllTimersAsync();
        await expect(promise).resolves.not.toThrow();
    });
});
