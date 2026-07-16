jest.mock('../../models/BirthdaySchema', () => ({
    find: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../models/GuildSchema', () => ({
    find: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../utils/guildConfig', () => ({ getGuildConfig: jest.fn() }));

import BirthdaySchema from '../../models/BirthdaySchema';
import GuildSchema from '../../models/GuildSchema';
import { getGuildConfig } from '../../utils/guildConfig';
import { checkBirthdays } from '../../utils/birthday';

const mockedBirthdaySchema = BirthdaySchema as any;
const mockedGuildSchema = GuildSchema as any;
const mockedGetGuildConfig = getGuildConfig as jest.Mock;

function makeGuild({ birthdayRoleId = null as string | null } = {}) {
    const channel = { send: jest.fn().mockResolvedValue({}) };
    const role = { members: new Map() };
    const guild: any = {
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
        mockedBirthdaySchema.find.mockResolvedValue([]);
        mockedGuildSchema.find.mockResolvedValue([]);
    });

    test('posts an announcement for a matching birthday and marks it announced', async () => {
        const guild = makeGuild();
        const client = { guilds: { cache: new Map([['g1', guild]]) } } as any;

        mockedBirthdaySchema.find.mockResolvedValue([{ _id: 'b1', guildId: 'g1', userId: 'u1' }]);
        mockedGetGuildConfig.mockResolvedValue({ birthdayChannelId: 'c1', birthdayMessage: null, birthdayRoleId: null });

        await checkBirthdays(client);

        expect(guild.__channel.send).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('<@u1>') })
        );
        expect(mockedBirthdaySchema.updateOne).toHaveBeenCalledWith(
            { _id: 'b1' },
            expect.objectContaining({ $set: expect.objectContaining({ lastAnnounced: expect.any(Number) }) })
        );
    });

    test('substitutes {age} using the current year minus the stored birth year', async () => {
        const guild = makeGuild();
        const client = { guilds: { cache: new Map([['g1', guild]]) } } as any;
        const expectedAge = new Date().getFullYear() - 1995;

        mockedBirthdaySchema.find.mockResolvedValue([{ _id: 'b1', guildId: 'g1', userId: 'u1', year: 1995 }]);
        mockedGetGuildConfig.mockResolvedValue({ birthdayChannelId: 'c1', birthdayMessage: 'You turn {age}!', birthdayRoleId: null });

        await checkBirthdays(client);

        expect(guild.__channel.send).toHaveBeenCalledWith(
            expect.objectContaining({ content: `You turn ${expectedAge}!` })
        );
    });

    test('falls back to a generic phrase for {age} when no birth year was given', async () => {
        const guild = makeGuild();
        const client = { guilds: { cache: new Map([['g1', guild]]) } } as any;

        mockedBirthdaySchema.find.mockResolvedValue([{ _id: 'b1', guildId: 'g1', userId: 'u1', year: null }]);
        mockedGetGuildConfig.mockResolvedValue({ birthdayChannelId: 'c1', birthdayMessage: 'You turn {age}!', birthdayRoleId: null });

        await checkBirthdays(client);

        expect(guild.__channel.send).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'You turn another year older!' })
        );
    });

    test('grants the birthday role when configured', async () => {
        const guild = makeGuild();
        const client = { guilds: { cache: new Map([['g1', guild]]) } } as any;

        mockedBirthdaySchema.find.mockResolvedValue([{ _id: 'b1', guildId: 'g1', userId: 'u1' }]);
        mockedGetGuildConfig.mockResolvedValue({ birthdayChannelId: 'c1', birthdayMessage: null, birthdayRoleId: 'r1' });
        guild.roles.cache.set('r1', { members: new Map() });

        await checkBirthdays(client);

        expect(guild.__member.roles.add).toHaveBeenCalled();
    });

    test('clears the birthday role from prior holders before granting new ones', async () => {
        const guild = makeGuild({ birthdayRoleId: 'r1' });
        const client = { guilds: { cache: new Map([['g1', guild]]) } } as any;

        mockedGuildSchema.find.mockResolvedValue([{ guildId: 'g1', birthdayRoleId: 'r1' }]);
        mockedBirthdaySchema.find.mockResolvedValue([]);

        await checkBirthdays(client);

        expect(guild.__member.roles.remove).toHaveBeenCalledWith(guild.__role);
    });

    test('skips guilds without a configured birthday channel', async () => {
        const guild = makeGuild();
        const client = { guilds: { cache: new Map([['g1', guild]]) } } as any;

        mockedBirthdaySchema.find.mockResolvedValue([{ _id: 'b1', guildId: 'g1', userId: 'u1' }]);
        mockedGetGuildConfig.mockResolvedValue({ birthdayChannelId: null });

        await checkBirthdays(client);

        expect(guild.__channel.send).not.toHaveBeenCalled();
        expect(mockedBirthdaySchema.updateOne).not.toHaveBeenCalled();
    });
});
