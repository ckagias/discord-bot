import { Client } from 'discord.js';
import PunishmentSchema from '../models/PunishmentSchema';
import log = require('./log');
const logger = log.scope('punishments');

// setTimeout delays beyond this overflow and fire immediately, so longer waits are chunked.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

function parseDuration(str: string): number | null {
    const match = str.match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const units: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * units[match[2].toLowerCase()];
}

// Discord error codes meaning there's nothing left to undo, safe to treat as success.
const UNKNOWN_MEMBER_OR_BAN_CODES = [10007, 10013, 10026];

async function liftMute(client: Client, punishment: any): Promise<void> {
    try {
        const guild = await client.guilds.fetch(punishment.guildId).catch(() => null);
        if (!guild) {
            await PunishmentSchema.deleteOne({ _id: punishment._id }).catch(() => {});
            return;
        }

        const member = await guild.members.fetch(punishment.userId).catch(() => null);
        if (member && punishment.muteRoleId) {
            await member.roles.remove(punishment.muteRoleId, 'Timed mute expired');
        }
        await PunishmentSchema.deleteOne({ _id: punishment._id }).catch(() => {});
    } catch (err) {
        if (UNKNOWN_MEMBER_OR_BAN_CODES.includes((err as any)?.code)) {
            await PunishmentSchema.deleteOne({ _id: punishment._id }).catch(() => {});
            return;
        }
        logger.error('Failed to lift mute, will retry on next restart:', err);
    }
}

async function liftBan(client: Client, punishment: any): Promise<void> {
    try {
        const guild = await client.guilds.fetch(punishment.guildId).catch(() => null);
        if (!guild) {
            await PunishmentSchema.deleteOne({ _id: punishment._id }).catch(() => {});
            return;
        }

        await guild.members.unban(punishment.userId, 'Temp ban expired');
        await PunishmentSchema.deleteOne({ _id: punishment._id }).catch(() => {});
    } catch (err) {
        if (UNKNOWN_MEMBER_OR_BAN_CODES.includes((err as any)?.code)) {
            await PunishmentSchema.deleteOne({ _id: punishment._id }).catch(() => {});
            return;
        }
        logger.error('Failed to lift ban, will retry on next restart:', err);
    }
}

// Schedule a single punishment to be lifted. Called both on creation and on bot restart.
function schedulePunishment(client: Client, punishment: any, remaining: number = punishment.expiresAt.getTime() - Date.now()): void {
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
async function restorePunishments(client: Client): Promise<void> {
    const active = await PunishmentSchema.find({}).catch(() => []);
    for (const p of active) schedulePunishment(client, p);
    if (active.length) logger.info(`Restored ${active.length} active timed punishment(s).`);
}

export { parseDuration, schedulePunishment, restorePunishments, liftMute, liftBan };
