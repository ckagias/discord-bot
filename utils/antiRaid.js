const { PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { getLogChannel } = require('./logger');
const { updateGuildConfig } = require('./guildConfig');
const { randomColor } = require('./embeds');
const log = require('./log');
const logger = log.scope('antiraid');

// Members with these permissions are never quarantined.
const STAFF_PERMISSIONS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ManageGuild,
];

// guildId -> array of join timestamps (ms). In-memory only — resets on restart.
// Lockdown *state* is persisted on the Guild doc; only the rolling window is ephemeral.
const joinTracker = new Map();

function isStaff(member) {
    if (!member) return false;
    return STAFF_PERMISSIONS.some(perm => member.permissions.has(perm));
}

// Pushes a join timestamp, prunes to windowSeconds, returns current count.
function recordJoin(guildId, windowSeconds) {
    const key = guildId;
    const now = Date.now();
    const windowMs = windowSeconds * 1_000;
    const timestamps = (joinTracker.get(key) ?? []).filter(t => now - t < windowMs);
    timestamps.push(now);
    joinTracker.set(key, timestamps);
    return timestamps.length;
}

// Sets channel overwrites so the quarantine role cannot see or participate in any channel.
// Mirrors the mute-role pattern in slashCommands/moderation/mute.js.
async function ensureQuarantineOverwrites(guild, role) {
    const deny = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Connect,
    ];

    const results = await Promise.allSettled(
        guild.channels.cache
            .filter(ch =>
                ch.type === ChannelType.GuildText ||
                ch.type === ChannelType.GuildVoice ||
                ch.type === ChannelType.GuildAnnouncement ||
                ch.type === ChannelType.GuildForum
            )
            .map(ch =>
                ch.permissionOverwrites.edit(role, Object.fromEntries(deny.map(p => [p, false])), {
                    reason: 'Anti-raid: quarantine role lockdown',
                })
            )
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
        logger.warn(`${failed.length} channel overwrite(s) failed for role ${role.id} in ${guild.id}`);
    }
}

// Assigns the quarantine role to a member. Returns true if quarantined.
async function quarantineMember(member, guildData) {
    if (!guildData?.antiRaidQuarantineRoleId) return false;
    if (member.user.bot) return false;
    if (isStaff(member)) return false;

    const { guild } = member;
    const role = guild.roles.cache.get(guildData.antiRaidQuarantineRoleId);
    if (!role) return false;

    // Bot must outrank the quarantine role.
    if (guild.members.me.roles.highest.position <= role.position) return false;

    // Already quarantined.
    if (member.roles.cache.has(role.id)) return true;

    await member.roles.add(role, 'Anti-raid: lockdown active').catch(err =>
        logger.error(`Failed to quarantine ${member.id} in ${guild.id}:`, err)
    );

    return true;
}

// Resolves the alert channel: explicit antiRaidAlertChannelId, otherwise the guild log channel.
async function resolveAlertChannel(guild, guildData) {
    if (guildData?.antiRaidAlertChannelId) {
        return guild.channels.cache.get(guildData.antiRaidAlertChannelId) ?? null;
    }
    return getLogChannel(guild).catch(() => null);
}

// Activates a lockdown, sets channel overwrites, and posts an alert embed.
async function startLockdown(guild, guildData, { auto = false, triggeredBy = null } = {}) {
    if (guildData?.antiRaidLocked) return; // already locked

    const role = guild.roles.cache.get(guildData?.antiRaidQuarantineRoleId);
    if (!role) return;

    // Atomic check-and-set: only one concurrent caller wins the lockdown race.
    const GuildSchema = require('../models/GuildSchema');
    const updated = await GuildSchema.findOneAndUpdate(
        { guildId: guild.id, antiRaidLocked: { $ne: true } },
        { $set: { antiRaidLocked: true, antiRaidLockedAt: new Date() } },
        { new: true },
    );
    if (!updated) return; // another call already won
    await ensureQuarantineOverwrites(guild, role);

    const alertChannel = await resolveAlertChannel(guild, guildData);
    if (!alertChannel) return;

    const triggerText = auto
        ? `Auto-triggered: ${guildData.antiRaidJoinThreshold} joins in ${guildData.antiRaidJoinWindow}s`
        : `Manually triggered by ${triggeredBy ? `**${triggeredBy.username}**` : 'a moderator'}`;

    const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔒 Raid Lockdown Active')
        .setDescription(
            `New members will be assigned ${role} and blocked from the server until the lockdown is lifted.\n\n` +
            `**Trigger:** ${triggerText}\n\n` +
            `Use \`/antiraid unlock\` to end the lockdown — it will automatically release all quarantined members and post a summary. ` +
            `Ban or kick obvious raiders before unlocking if needed.`
        )
        .setTimestamp();

    await alertChannel.send({ embeds: [embed] }).catch(() => {});
}

// Deactivates a lockdown, removes the quarantine role from all members who have it,
// and posts a summary embed. Returns the list of released members for the command reply.
async function endLockdown(guild, guildData, { by = null } = {}) {
    if (!guildData?.antiRaidLocked) return { alreadyUnlocked: true };

    const role = guild.roles.cache.get(guildData?.antiRaidQuarantineRoleId);
    const released = [];

    if (role) {
        // Fetch all members to ensure the cache is complete, then release anyone still holding the role.
        const members = await guild.members.fetch().catch(() => null);
        if (members) {
            const quarantined = members.filter(m => m.roles.cache.has(role.id));
            await Promise.allSettled(
                quarantined.map(m =>
                    m.roles.remove(role, `Anti-raid: lockdown lifted by ${by?.tag ?? 'moderator'}`).then(() => {
                        released.push(m);
                    })
                )
            );
        }
    }

    // Update DB only after roles are released so a mid-release crash leaves state recoverable.
    await updateGuildConfig(guild.id, { antiRaidLocked: false, antiRaidLockedAt: null });

    const alertChannel = await resolveAlertChannel(guild, guildData);
    if (alertChannel) {
        const byText = by ? `**${by.username}**` : 'a moderator';

        let description = `Lockdown ended by ${byText}. New members will join normally again.\n\n`;

        if (released.length === 0) {
            description += '*No members were quarantined.*';
        } else {
            // Discord embed descriptions cap at 4096 chars — truncate the member list if huge.
            const lines = released.map(m => `• ${m.user.username} (\`${m.id}\`)`);
            const header = `**${released.length} member${released.length !== 1 ? 's' : ''} released from quarantine:**\n`;
            const body = lines.join('\n');
            const truncated = header.length + body.length > 3900
                ? header + lines.slice(0, 50).join('\n') + `\n*...and ${released.length - 50} more*`
                : header + body;
            description += truncated;
        }

        const embed = new EmbedBuilder()
            .setColor(randomColor())
            .setTitle('🔓 Raid Lockdown Lifted')
            .setDescription(description)
            .setTimestamp();

        await alertChannel.send({ embeds: [embed] }).catch(() => {});
    }

    return { released };
}

// Schedules the quarantine role assignment after a short delay so Discord's join log
// fires first and welcome embeds don't race with the role change.
function scheduleQuarantine(member, guildData, delayMs = 500) {
    setTimeout(async () => {
        // Re-fetch the member in case they left in the tiny window.
        const fresh = await member.guild.members.fetch(member.id).catch(() => null);
        if (!fresh) return;
        await quarantineMember(fresh, guildData).catch(err =>
            logger.error(`Delayed quarantine failed for ${member.id}:`, err)
        );
        logger.info(`Quarantined ${member.user.tag} (${member.id}) in ${member.guild.id}`);
    }, delayMs);
}

// Entry point called from guildMemberAdd.
// Returns true if this member should be quarantined (blocks autorole — role is applied after delay).
function handleJoin(member, guildData) {
    if (!guildData) return false;

    // Active lockdown: quarantine after delay.
    if (guildData.antiRaidLocked) {
        if (member.user.bot) return false;
        if (isStaff(member)) return false;
        if (!guildData.antiRaidQuarantineRoleId) return false;
        scheduleQuarantine(member, guildData);
        return true;
    }

    // Auto-detection: only fires if enabled and a quarantine role is configured.
    if (!guildData.antiRaidEnabled) return false;
    if (!guildData.antiRaidQuarantineRoleId) return false;

    const threshold = guildData.antiRaidJoinThreshold ?? 10;
    const window = guildData.antiRaidJoinWindow ?? 10;
    const count = recordJoin(member.guild.id, window);

    if (count >= threshold) {
        // Fire-and-forget: start lockdown async, then schedule quarantine for this member.
        startLockdown(member.guild, guildData, { auto: true }).catch(err =>
            logger.error('startLockdown error:', err)
        );
        if (!member.user.bot && !isStaff(member)) {
            scheduleQuarantine(member, guildData);
            return true;
        }
    }

    return false;
}

// Called on bot startup to re-assert quarantine overwrites for any guild still in lockdown.
async function restoreLockdowns(client) {
    const GuildSchema = require('../models/GuildSchema');
    const locked = await GuildSchema.find({ antiRaidLocked: true }).catch(() => []);
    if (!locked.length) return;

    let restored = 0;
    for (const doc of locked) {
        const guild = client.guilds.cache.get(doc.guildId);
        if (!guild) continue;
        const role = guild.roles.cache.get(doc.antiRaidQuarantineRoleId);
        if (!role) continue;
        await ensureQuarantineOverwrites(guild, role);
        restored++;
    }

    if (restored) logger.info(`Re-asserted quarantine overwrites in ${restored} guild(s) on startup.`);
}

module.exports = {
    handleJoin,
    startLockdown,
    endLockdown,
    quarantineMember,
    ensureQuarantineOverwrites,
    restoreLockdowns,
};
