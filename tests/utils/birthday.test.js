jest.mock('../../models/BirthdaySchema', () => ({
    find: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../models/GuildSchema', () => ({
    find: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../utils/guildConfig', () => ({ getGuildConfig: jest.fn() }));

const BirthdaySchema = require('../../models/BirthdaySchema');
const GuildSchema = require('../../models/GuildSchema');
const { getGuildConfig } = require('../../utils/guildConfig');
const { checkBirthdays } = require('../../utils/birthday');

function makeGuild({ birthdayRoleId = null } = {}) {
    const channel = { send: jest.fn().mockResolvedValue({}) };
    const role = { members: new Map() };
    const guild = {
        id: 'g1',
        name: 'Test Guild',
        channels: { cache: new Map([['c1', channel]]) },
        roles: { cache: new Map(birthdayRoleId ? [[birthdayRoleId, role]] : []) },
    };
    const member = {
        id: 'u1',
        guild,
        roles: { add: jest.fn().mockResolvedValue({}), remove: jest.fn().mockResolvedValue({}) },
    };
    if (birthdayRoleId) role.members.set('u1', member);

    guild.members = { fetch: jest.fn().mockResolvedValue(member) };
    guild.__channel = channel;
    guild.__member = member;
    guild.__role = role;
    return guild;
}

describe('checkBirthdays', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        BirthdaySchema.find.mockResolvedValue([]);
        GuildSchema.find.mockResolvedValue([]);
    });

    test('posts an announcement for a matching birthday and marks it announced', async () => {
        const guild = makeGuild();
        const client = { guilds: { cache: new Map([['g1', guild]]) } };

        BirthdaySchema.find.mockResolvedValue([{ _id: 'b1', guildId: 'g1', userId: 'u1' }]);
        getGuildConfig.mockResolvedValue({ birthdayChannelId: 'c1', birthdayMessage: null, birthdayRoleId: null });

        await checkBirthdays(client);

        expect(guild.__channel.send).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('<@u1>') })
        );
        expect(BirthdaySchema.updateOne).toHaveBeenCalledWith(
            { _id: 'b1' },
            expect.objectContaining({ $set: expect.objectContaining({ lastAnnounced: expect.any(Number) }) })
        );
    });

    test('substitutes {age} using the current year minus the stored birth year', async () => {
        const guild = makeGuild();
        const client = { guilds: { cache: new Map([['g1', guild]]) } };
        const expectedAge = new Date().getFullYear() - 1995;

        BirthdaySchema.find.mockResolvedValue([{ _id: 'b1', guildId: 'g1', userId: 'u1', year: 1995 }]);
        getGuildConfig.mockResolvedValue({ birthdayChannelId: 'c1', birthdayMessage: 'You turn {age}!', birthdayRoleId: null });

        await checkBirthdays(client);

        expect(guild.__channel.send).toHaveBeenCalledWith(
            expect.objectContaining({ content: `You turn ${expectedAge}!` })
        );
    });

    test('falls back to a generic phrase for {age} when no birth year was given', async () => {
        const guild = makeGuild();
        const client = { guilds: { cache: new Map([['g1', guild]]) } };

        BirthdaySchema.find.mockResolvedValue([{ _id: 'b1', guildId: 'g1', userId: 'u1', year: null }]);
        getGuildConfig.mockResolvedValue({ birthdayChannelId: 'c1', birthdayMessage: 'You turn {age}!', birthdayRoleId: null });

        await checkBirthdays(client);

        expect(guild.__channel.send).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You turn another year older!' })
        );
    });

    test('grants the birthday role when configured', async () => {
        const guild = makeGuild();
        const client = { guilds: { cache: new Map([['g1', guild]]) } };

        BirthdaySchema.find.mockResolvedValue([{ _id: 'b1', guildId: 'g1', userId: 'u1' }]);
        getGuildConfig.mockResolvedValue({ birthdayChannelId: 'c1', birthdayMessage: null, birthdayRoleId: 'r1' });
        guild.roles.cache.set('r1', { members: new Map() });

        await checkBirthdays(client);

        expect(guild.__member.roles.add).toHaveBeenCalled();
    });

    test('clears the birthday role from prior holders before granting new ones', async () => {
        const guild = makeGuild({ birthdayRoleId: 'r1' });
        const client = { guilds: { cache: new Map([['g1', guild]]) } };

        GuildSchema.find.mockResolvedValue([{ guildId: 'g1', birthdayRoleId: 'r1' }]);
        BirthdaySchema.find.mockResolvedValue([]);

        await checkBirthdays(client);

        expect(guild.__member.roles.remove).toHaveBeenCalledWith(guild.__role);
    });

    test('skips guilds without a configured birthday channel', async () => {
        const guild = makeGuild();
        const client = { guilds: { cache: new Map([['g1', guild]]) } };

        BirthdaySchema.find.mockResolvedValue([{ _id: 'b1', guildId: 'g1', userId: 'u1' }]);
        getGuildConfig.mockResolvedValue({ birthdayChannelId: null });

        await checkBirthdays(client);

        expect(guild.__channel.send).not.toHaveBeenCalled();
        expect(BirthdaySchema.updateOne).not.toHaveBeenCalled();
    });
});
