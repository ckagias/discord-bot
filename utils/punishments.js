const PunishmentSchema = require('../models/PunishmentSchema');
const log = require('./log');
const logger = log.scope('punishments');

// setTimeout delays beyond this overflow and fire immediately, so longer waits are chunked.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

function parseDuration(str) {
    const match = str.match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * units[match[2].toLowerCase()];
}

async function liftMute(client, punishment) {
    try {
        const guild = await client.guilds.fetch(punishment.guildId).catch(() => null);
        if (!guild) return;

        const member = await guild.members.fetch(punishment.userId).catch(() => null);
        if (member && punishment.muteRoleId) {
            await member.roles.remove(punishment.muteRoleId, 'Timed mute expired').catch(() => {});
        }
    } catch (err) {
        logger.error('Failed to lift mute:', err);
    } finally {
        await PunishmentSchema.deleteOne({ _id: punishment._id }).catch(() => {});
    }
}

async function liftBan(client, punishment) {
    try {
        const guild = await client.guilds.fetch(punishment.guildId).catch(() => null);
        if (!guild) return;

        await guild.members.unban(punishment.userId, 'Temp ban expired').catch(() => {});
    } catch (err) {
        logger.error('Failed to lift ban:', err);
    } finally {
        await PunishmentSchema.deleteOne({ _id: punishment._id }).catch(() => {});
    }
}

// Schedule a single punishment to be lifted. Called both on creation and on bot restart.
function schedulePunishment(client, punishment, remaining = punishment.expiresAt.getTime() - Date.now()) {
    if (remaining > MAX_TIMEOUT_MS) {
        setTimeout(() => schedulePunishment(client, punishment, remaining - MAX_TIMEOUT_MS), MAX_TIMEOUT_MS);
        return;
    }

    setTimeout(() => {
        if (punishment.type === 'mute') liftMute(client, punishment).catch(err => logger.error('liftMute error:', err));
        else liftBan(client, punishment).catch(err => logger.error('liftBan error:', err));
    }, Math.max(remaining, 0));
}

// Restore all active timed punishments after a bot restart.
async function restorePunishments(client) {
    const active = await PunishmentSchema.find({}).catch(() => []);
    for (const p of active) schedulePunishment(client, p);
    if (active.length) logger.info(`Restored ${active.length} active timed punishment(s).`);
}

module.exports = { parseDuration, schedulePunishment, restorePunishments };
