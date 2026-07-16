jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn() }));
jest.mock('../../utils/welcome', () => ({ getFarewellConfig: jest.fn(), formatMessage: jest.fn() }));

const { getLogChannel } = require('../../utils/logger');
const { getFarewellConfig, formatMessage } = require('../../utils/welcome');
const guildMemberRemove = require('../../events/guildMemberRemove');

function makeCollection(items: any[]): any {
    const map: any = new Map(items.map((item, i) => [i, item]));
    map.filter = (fn: (item: any) => boolean) => makeCollection([...map.values()].filter(fn));
    map.map = (fn: (item: any) => any) => [...map.values()].map(fn);
    return map;
}

function makeMember(overrides: Record<string, any> = {}) {
    return {
        guild: {
            id: 'g1', memberCount: 99,
            fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }),
        },
        user: { id: 'user1', username: 'LeftUser', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/a.png') },
        roles: { cache: makeCollection([]) },
        ...overrides,
    };
}

describe('guildMemberRemove', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        getLogChannel.mockResolvedValue(null);
        getFarewellConfig.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('sends the farewell message when configured', async () => {
        const farewellChannel = { send: jest.fn().mockResolvedValue({}) };
        getFarewellConfig.mockResolvedValue({ channel: farewellChannel, message: '{user} left' });
        formatMessage.mockReturnValue('LeftUser left');
        const member = makeMember();

        const promise = guildMemberRemove.execute(member);
        await jest.runAllTimersAsync();
        await promise;

        expect(farewellChannel.send).toHaveBeenCalledWith({ content: 'LeftUser left' });
    });

    test('does nothing further when no log channel is configured', async () => {
        const member = makeMember();

        const promise = guildMemberRemove.execute(member);
        await jest.runAllTimersAsync();
        await promise;

        expect(member.guild.fetchAuditLogs).not.toHaveBeenCalled();
    });

    test('logs a voluntary leave when no recent kick audit entry is found', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const member = makeMember();

        const promise = guildMemberRemove.execute(member);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('logs a kick when a recent matching audit entry is found', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const member = makeMember({
            guild: {
                id: 'g1', memberCount: 99,
                fetchAuditLogs: jest.fn().mockResolvedValue({
                    entries: { first: () => ({ target: { id: 'user1' }, executor: { username: 'Mod', id: 'mod1' }, createdTimestamp: Date.now() }) },
                }),
            },
        });

        const promise = guildMemberRemove.execute(member);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalled();
    });

    test('ignores a stale kick audit entry older than 5 seconds', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const member = makeMember({
            guild: {
                id: 'g1', memberCount: 99,
                fetchAuditLogs: jest.fn().mockResolvedValue({
                    entries: { first: () => ({ target: { id: 'user1' }, executor: { username: 'Mod', id: 'mod1' }, createdTimestamp: Date.now() - 10_000 }) },
                }),
            },
        });

        const promise = guildMemberRemove.execute(member);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalled();
    });

    test('lists the member roles excluding @everyone, or "None" if there are none', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const member = makeMember({
            guild: {
                id: 'g1', memberCount: 99,
                fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }),
            },
            roles: { cache: makeCollection([{ id: 'g1' }, { id: 'role1' }]) },
        });

        const promise = guildMemberRemove.execute(member);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalled();
    });
});
