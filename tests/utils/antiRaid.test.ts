jest.mock('../../models/GuildSchema', () => ({ findOneAndUpdate: jest.fn(), find: jest.fn() }));
jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn() }));
jest.mock('../../utils/guildConfig', () => ({ updateGuildConfig: jest.fn() }));
jest.mock('../../utils/embeds', () => ({ randomColor: () => 0x000000 }));

import { PermissionFlagsBits, Collection } from 'discord.js';
import GuildSchema from '../../models/GuildSchema';
import { getLogChannel } from '../../utils/logger';
import { updateGuildConfig } from '../../utils/guildConfig';
import {
    handleJoin,
    startLockdown,
    endLockdown,
    quarantineMember,
    ensureQuarantineOverwrites,
    restoreLockdowns,
} from '../../utils/antiRaid';

const mockedGuildSchema = GuildSchema as any;
const mockedGetLogChannel = getLogChannel as jest.Mock;
const mockedUpdateGuildConfig = updateGuildConfig as jest.Mock;

function makeMember({ id = 'member1', bot = false, perms = [] as any[], hasRole = false } = {}) {
    return {
        id,
        user: { id, bot, username: `user-${id}`, tag: `user-${id}#0001` },
        permissions: { has: (perm: any) => perms.includes(perm) },
        roles: {
            cache: { has: jest.fn().mockReturnValue(hasRole) },
            add: jest.fn().mockResolvedValue(undefined),
            remove: jest.fn().mockResolvedValue(undefined),
        },
        guild: undefined as any,
    };
}

function makeGuild({ id = 'g1', botPosition = 10, rolePosition = 1 } = {}) {
    const guild: any = {
        id,
        roles: { cache: new Collection([['role1', { id: 'role1', position: rolePosition }]]) },
        channels: { cache: new Collection() },
        members: { me: { roles: { highest: { position: botPosition } } }, fetch: jest.fn() },
    };
    return guild;
}

describe('isStaff (via quarantineMember)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('does not quarantine a member with ManageGuild', async () => {
        const guild = makeGuild();
        const member = makeMember({ perms: [PermissionFlagsBits.ManageGuild] });
        member.guild = guild;

        const result = await quarantineMember(member as any, { antiRaidQuarantineRoleId: 'role1' });

        expect(result).toBe(false);
        expect(member.roles.add).not.toHaveBeenCalled();
    });
});

describe('quarantineMember', () => {
    beforeEach(() => jest.clearAllMocks());

    test('returns false when no quarantine role is configured', async () => {
        const member = makeMember();
        const result = await quarantineMember(member as any, {});
        expect(result).toBe(false);
    });

    test('returns false for bot members', async () => {
        const guild = makeGuild();
        const member = makeMember({ bot: true });
        member.guild = guild;

        const result = await quarantineMember(member as any, { antiRaidQuarantineRoleId: 'role1' });

        expect(result).toBe(false);
    });

    test('returns false when the configured role no longer exists', async () => {
        const guild = makeGuild();
        const member = makeMember();
        member.guild = guild;

        const result = await quarantineMember(member as any, { antiRaidQuarantineRoleId: 'missing-role' });

        expect(result).toBe(false);
    });

    test('returns false when the bot is outranked by the quarantine role', async () => {
        const guild = makeGuild({ botPosition: 1, rolePosition: 10 });
        const member = makeMember();
        member.guild = guild;

        const result = await quarantineMember(member as any, { antiRaidQuarantineRoleId: 'role1' });

        expect(result).toBe(false);
        expect(member.roles.add).not.toHaveBeenCalled();
    });

    test('returns true without re-adding the role if already quarantined', async () => {
        const guild = makeGuild();
        const member = makeMember({ hasRole: true });
        member.guild = guild;

        const result = await quarantineMember(member as any, { antiRaidQuarantineRoleId: 'role1' });

        expect(result).toBe(true);
        expect(member.roles.add).not.toHaveBeenCalled();
    });

    test('adds the quarantine role and returns true', async () => {
        const guild = makeGuild();
        const member = makeMember();
        member.guild = guild;

        const result = await quarantineMember(member as any, { antiRaidQuarantineRoleId: 'role1' });

        expect(result).toBe(true);
        expect(member.roles.add).toHaveBeenCalledWith(expect.objectContaining({ id: 'role1' }), expect.any(String));
    });
});

describe('handleJoin', () => {
    beforeEach(() => jest.clearAllMocks());

    test('returns false with no guild config', () => {
        const member = makeMember();
        expect(handleJoin(member as any, null)).toBe(false);
    });

    test('schedules quarantine for a non-staff member during active lockdown', async () => {
        jest.useFakeTimers();
        const guild = makeGuild();
        guild.members.fetch.mockResolvedValue(null);
        const member = makeMember();
        member.guild = guild;

        const result = handleJoin(member as any, { antiRaidLocked: true, antiRaidQuarantineRoleId: 'role1' });
        expect(result).toBe(true);

        await jest.runOnlyPendingTimersAsync();
        jest.useRealTimers();

        expect(guild.members.fetch).toHaveBeenCalledWith(member.id);
    });

    test('does not quarantine staff during active lockdown', () => {
        const member = makeMember({ perms: [PermissionFlagsBits.Administrator] });

        const result = handleJoin(member as any, { antiRaidLocked: true, antiRaidQuarantineRoleId: 'role1' });

        expect(result).toBe(false);
    });

    test('does not quarantine bots during active lockdown', () => {
        const member = makeMember({ bot: true });

        const result = handleJoin(member as any, { antiRaidLocked: true, antiRaidQuarantineRoleId: 'role1' });

        expect(result).toBe(false);
    });

    test('returns false during lockdown when no quarantine role is configured', () => {
        const member = makeMember();

        const result = handleJoin(member as any, { antiRaidLocked: true });

        expect(result).toBe(false);
    });

    test('returns false when auto-detection is disabled', () => {
        const member = makeMember();
        member.guild = makeGuild();

        const result = handleJoin(member as any, { antiRaidEnabled: false });

        expect(result).toBe(false);
    });

    test('triggers auto-lockdown once the join threshold is hit within the window', async () => {
        jest.useFakeTimers();
        mockedGuildSchema.findOneAndUpdate.mockResolvedValue(null);
        const guild = makeGuild({ id: 'auto-guild' });
        guild.members.fetch.mockResolvedValue(null);
        const guildData = { antiRaidEnabled: true, antiRaidQuarantineRoleId: 'role1', antiRaidJoinThreshold: 2, antiRaidJoinWindow: 10 };

        const member1 = makeMember({ id: 'm1' });
        member1.guild = guild;
        const member2 = makeMember({ id: 'm2' });
        member2.guild = guild;

        expect(handleJoin(member1 as any, guildData)).toBe(false);
        const result = handleJoin(member2 as any, guildData);
        expect(result).toBe(true);

        await jest.runOnlyPendingTimersAsync();
        jest.useRealTimers();
    });

    test('does not re-trigger lockdown for joins below the threshold', () => {
        const guild = makeGuild({ id: 'below-threshold-guild' });
        const guildData = { antiRaidEnabled: true, antiRaidQuarantineRoleId: 'role1', antiRaidJoinThreshold: 5, antiRaidJoinWindow: 10 };
        const member = makeMember();
        member.guild = guild;

        const result = handleJoin(member as any, guildData);

        expect(result).toBe(false);
    });
});

describe('startLockdown', () => {
    beforeEach(() => jest.clearAllMocks());

    test('does nothing if already locked', async () => {
        const guild = makeGuild();
        await startLockdown(guild, { antiRaidLocked: true, antiRaidQuarantineRoleId: 'role1' });

        expect(mockedGuildSchema.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('does nothing if the quarantine role no longer exists', async () => {
        const guild = makeGuild();
        await startLockdown(guild, { antiRaidQuarantineRoleId: 'missing-role' });

        expect(mockedGuildSchema.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('backs off when another concurrent call already won the lockdown race', async () => {
        mockedGuildSchema.findOneAndUpdate.mockResolvedValue(null);
        const guild = makeGuild();

        await startLockdown(guild, { antiRaidQuarantineRoleId: 'role1' });

        expect(mockedGetLogChannel).not.toHaveBeenCalled();
    });

    test('posts an alert embed to the resolved alert channel on success', async () => {
        mockedGuildSchema.findOneAndUpdate.mockResolvedValue({ antiRaidLocked: true });
        const guild = makeGuild();
        const send = jest.fn().mockResolvedValue(undefined);
        const channel = { send };
        guild.channels.cache.set('log1', channel);
        mockedGetLogChannel.mockResolvedValue(channel);

        await startLockdown(guild, { antiRaidQuarantineRoleId: 'role1', antiRaidAlertChannelId: null }, { auto: true });

        expect(send).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
    });

    test('does nothing further when no alert channel can be resolved', async () => {
        mockedGuildSchema.findOneAndUpdate.mockResolvedValue({ antiRaidLocked: true });
        const guild = makeGuild();
        mockedGetLogChannel.mockResolvedValue(null);

        await expect(startLockdown(guild, { antiRaidQuarantineRoleId: 'role1' })).resolves.toBeUndefined();
    });
});

describe('endLockdown', () => {
    beforeEach(() => jest.clearAllMocks());

    test('reports already unlocked when guild is not locked', async () => {
        const guild = makeGuild();
        const result = await endLockdown(guild, { antiRaidLocked: false });
        expect(result).toEqual({ alreadyUnlocked: true });
    });

    test('releases quarantined members and updates the config', async () => {
        const guild = makeGuild();
        const quarantined = makeMember({ id: 'q1', hasRole: true });
        const notQuarantined = makeMember({ id: 'q2', hasRole: false });
        const membersCollection = new Collection([
            ['q1', quarantined],
            ['q2', notQuarantined],
        ]);
        guild.members.fetch.mockResolvedValue(membersCollection);
        mockedGetLogChannel.mockResolvedValue(null);

        const result = await endLockdown(guild, { antiRaidLocked: true, antiRaidQuarantineRoleId: 'role1' }, { by: { username: 'Mod' } });

        expect(quarantined.roles.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'role1' }), expect.stringContaining('Mod'));
        expect(notQuarantined.roles.remove).not.toHaveBeenCalled();
        expect(result.released).toHaveLength(1);
        expect(mockedUpdateGuildConfig).toHaveBeenCalledWith('g1', { antiRaidLocked: false, antiRaidLockedAt: null });
    });

    test('posts a summary embed listing released members', async () => {
        const guild = makeGuild();
        const quarantined = makeMember({ id: 'q1', hasRole: true });
        const membersCollection = new Collection([['q1', quarantined]]);
        guild.members.fetch.mockResolvedValue(membersCollection);
        const send = jest.fn().mockResolvedValue(undefined);
        mockedGetLogChannel.mockResolvedValue({ send });

        await endLockdown(guild, { antiRaidLocked: true, antiRaidQuarantineRoleId: 'role1' });

        expect(send).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
    });

    test('handles a missing/undefined quarantine role gracefully', async () => {
        const guild = makeGuild();
        mockedGetLogChannel.mockResolvedValue(null);

        const result = await endLockdown(guild, { antiRaidLocked: true, antiRaidQuarantineRoleId: 'missing-role' });

        expect(result.released).toEqual([]);
        expect(mockedUpdateGuildConfig).toHaveBeenCalled();
    });
});

describe('restoreLockdowns', () => {
    beforeEach(() => jest.clearAllMocks());

    test('does nothing when no guilds are locked', async () => {
        mockedGuildSchema.find.mockResolvedValue([]);
        const client: any = { guilds: { cache: new Map() } };

        await restoreLockdowns(client);
    });

    test('re-asserts overwrites for guilds still in the client cache', async () => {
        mockedGuildSchema.find.mockResolvedValue([{ guildId: 'g1', antiRaidQuarantineRoleId: 'role1' }]);
        const guild = makeGuild();
        const client: any = { guilds: { cache: new Map([['g1', guild]]) } };

        await restoreLockdowns(client);
    });

    test('skips guilds the bot is no longer in', async () => {
        mockedGuildSchema.find.mockResolvedValue([{ guildId: 'gone', antiRaidQuarantineRoleId: 'role1' }]);
        const client: any = { guilds: { cache: new Map() } };

        await expect(restoreLockdowns(client)).resolves.toBeUndefined();
    });
});

describe('ensureQuarantineOverwrites', () => {
    test('edits overwrites for supported channel types and tolerates failures', async () => {
        const editSuccess = jest.fn().mockResolvedValue(undefined);
        const editFail = jest.fn().mockRejectedValue(new Error('missing permissions'));
        const guild: any = {
            channels: {
                cache: new Collection([
                    ['c1', { type: 0, permissionOverwrites: { edit: editSuccess } }],
                    ['c2', { type: 2, permissionOverwrites: { edit: editFail } }],
                    ['c3', { type: 99, permissionOverwrites: { edit: jest.fn() } }],
                ]),
            },
        };

        await ensureQuarantineOverwrites(guild, { id: 'role1' } as any);

        expect(editSuccess).toHaveBeenCalled();
        expect(editFail).toHaveBeenCalled();
    });
});
