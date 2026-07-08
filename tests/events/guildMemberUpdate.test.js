jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn() }));

const { getLogChannel } = require('../../utils/logger');
const guildMemberUpdate = require('../../events/guildMemberUpdate');

function makeRoleCache(roleIds) {
    const values = roleIds.map(id => ({ id }));
    const map = new Map(values.map(v => [v.id, v]));
    map.has = (id) => roleIds.includes(id);
    map.filter = (fn) => makeRoleCache(values.filter(fn).map(v => v.id));
    map.map = (fn) => values.map(fn);
    return map;
}

function makeMember({ nickname = null, roleIds = [] } = {}) {
    return {
        nickname,
        user: { id: 'user1', username: 'User', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/a.png') },
        roles: { cache: makeRoleCache(roleIds) },
    };
}

function makeGuild(overrides = {}) {
    return {
        id: 'g1',
        fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }),
        ...overrides,
    };
}

describe('guildMemberUpdate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('does nothing when no log channel is configured', async () => {
        getLogChannel.mockResolvedValue(null);
        const oldMember = makeMember();
        const newMember = { ...makeMember(), guild: makeGuild() };

        const promise = guildMemberUpdate.execute(oldMember, newMember);
        await jest.runAllTimersAsync();
        await promise;

        expect(newMember.guild.fetchAuditLogs).not.toHaveBeenCalled();
    });

    test('logs a nickname change', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const oldMember = makeMember({ nickname: 'Old' });
        const newMember = { ...makeMember({ nickname: 'New' }), guild: makeGuild() };

        const promise = guildMemberUpdate.execute(oldMember, newMember);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('does not log when the nickname and roles are unchanged', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const oldMember = makeMember({ nickname: 'Same', roleIds: ['role1'] });
        const newMember = { ...makeMember({ nickname: 'Same', roleIds: ['role1'] }), guild: makeGuild() };

        await guildMemberUpdate.execute(oldMember, newMember);

        expect(logChannel.send).not.toHaveBeenCalled();
    });

    test('omits the "Changed By" field when the member changed their own nickname', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const oldMember = makeMember({ nickname: 'Old' });
        const newMember = { ...makeMember({ nickname: 'New' }), guild: makeGuild({
            fetchAuditLogs: jest.fn().mockResolvedValue({
                entries: { first: () => ({ target: { id: 'user1' }, executor: { id: 'user1', username: 'User' }, createdTimestamp: Date.now() }) },
            }),
        }) };

        const promise = guildMemberUpdate.execute(oldMember, newMember);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalled();
    });

    test('logs added and removed roles', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const oldMember = makeMember({ roleIds: ['g1', 'role1'] });
        const newMember = { ...makeMember({ roleIds: ['g1', 'role2'] }), guild: makeGuild() };

        const promise = guildMemberUpdate.execute(oldMember, newMember);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('sends a separate embed for nickname and role changes when both occur', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const oldMember = makeMember({ nickname: 'Old', roleIds: ['role1'] });
        const newMember = { ...makeMember({ nickname: 'New', roleIds: ['role2'] }), guild: makeGuild() };

        const promise = guildMemberUpdate.execute(oldMember, newMember);
        await jest.runAllTimersAsync();
        await promise;

        expect(logChannel.send).toHaveBeenCalledTimes(2);
    });
});
