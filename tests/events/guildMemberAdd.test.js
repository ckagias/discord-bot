jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn() }));
jest.mock('../../utils/welcome', () => ({ getWelcomeConfig: jest.fn(), formatMessage: jest.fn() }));
jest.mock('../../utils/guildConfig', () => ({ getGuildConfig: jest.fn() }));
jest.mock('../../utils/antiRaid', () => ({ handleJoin: jest.fn() }));

const { getLogChannel } = require('../../utils/logger');
const { getWelcomeConfig, formatMessage } = require('../../utils/welcome');
const { getGuildConfig } = require('../../utils/guildConfig');
const { handleJoin } = require('../../utils/antiRaid');
const guildMemberAdd = require('../../events/guildMemberAdd');

function makeMember(overrides = {}) {
    return {
        id: 'user1',
        guild: { roles: { cache: { get: jest.fn() } }, memberCount: 100 },
        user: {
            id: 'user1', username: 'NewUser', createdTimestamp: Date.now() - 86_400_000 * 10,
            displayAvatarURL: jest.fn().mockReturnValue('https://example.com/a.png'),
        },
        roles: { add: jest.fn().mockResolvedValue({}) },
        ...overrides,
    };
}

describe('guildMemberAdd', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getLogChannel.mockResolvedValue(null);
        getWelcomeConfig.mockResolvedValue(null);
        getGuildConfig.mockResolvedValue(null);
        handleJoin.mockReturnValue(false);
    });

    test('assigns the autorole when configured and not quarantined', async () => {
        const role = { id: 'role1' };
        getGuildConfig.mockResolvedValue({ autoroleId: 'role1' });
        const member = makeMember();
        member.guild.roles.cache.get.mockReturnValue(role);

        await guildMemberAdd.execute(member);

        expect(member.roles.add).toHaveBeenCalledWith(role);
    });

    test('skips autorole assignment when the member is quarantined', async () => {
        handleJoin.mockReturnValue(true);
        getGuildConfig.mockResolvedValue({ autoroleId: 'role1' });
        const member = makeMember();
        member.guild.roles.cache.get.mockReturnValue({ id: 'role1' });

        await guildMemberAdd.execute(member);

        expect(member.roles.add).not.toHaveBeenCalled();
    });

    test('sends the welcome message when configured and not quarantined', async () => {
        const welcomeChannel = { send: jest.fn().mockResolvedValue({}) };
        getWelcomeConfig.mockResolvedValue({ channel: welcomeChannel, message: 'Welcome {user}!' });
        formatMessage.mockReturnValue('Welcome <@user1>!');
        const member = makeMember();

        await guildMemberAdd.execute(member);

        expect(welcomeChannel.send).toHaveBeenCalledWith({ content: 'Welcome <@user1>!' });
    });

    test('skips the welcome message when the member is quarantined', async () => {
        handleJoin.mockReturnValue(true);
        const welcomeChannel = { send: jest.fn().mockResolvedValue({}) };
        getWelcomeConfig.mockResolvedValue({ channel: welcomeChannel, message: 'Welcome {user}!' });
        const member = makeMember();

        await guildMemberAdd.execute(member);

        expect(welcomeChannel.send).not.toHaveBeenCalled();
    });

    test('still runs the join log even when quarantined', async () => {
        handleJoin.mockReturnValue(true);
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const member = makeMember();

        await guildMemberAdd.execute(member);

        expect(logChannel.send).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('does nothing further when no log channel is configured', async () => {
        const member = makeMember();

        await expect(guildMemberAdd.execute(member)).resolves.not.toThrow();
    });
});
