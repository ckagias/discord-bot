import { Client, Guild, GuildMember } from 'discord.js';
import BirthdaySchema from '../models/BirthdaySchema';
import GuildSchema from '../models/GuildSchema';
import { getGuildConfig } from './guildConfig';

const DEFAULT_BIRTHDAY_MESSAGE = "Happy Birthday {user}! You turn {age} today! 🎉";

function formatMessage(template: string, member: GuildMember, age: number | null = null): string {
    return template
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{server}/g, member.guild.name)
        .replace(/{age}/g, age !== null ? String(age) : 'another year older');
}

// Age turned today, based on the stored birth year. Null if no year was provided.
function calculateAge(entry: { year?: number | null }, year: number): number | null {
    if (!entry.year) return null;
    return year - entry.year;
}

// Clears yesterday's holders since the role should only be worn on the actual birthday.
async function clearBirthdayRoles(client: Client, guild: Guild, roleId: string): Promise<void> {
    const role = guild.roles.cache.get(roleId);
    if (!role) return;

    for (const member of role.members.values()) {
        await member.roles.remove(role).catch(() => {});
    }
}

// Tracks lastAnnounced per year to avoid duplicate posts on restart.
async function checkBirthdays(client: Client): Promise<void> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();

    const configuredGuilds = await GuildSchema.find({ birthdayChannelId: { $ne: null } }).catch(() => []);
    for (const config of configuredGuilds) {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild || !config.birthdayRoleId) continue;
        await clearBirthdayRoles(client, guild, config.birthdayRoleId);
    }

    const todays = await BirthdaySchema.find({ month, day, lastAnnounced: { $ne: year } });
    if (!todays.length) return;

    const byGuild = new Map<string, any[]>();
    for (const entry of todays) {
        if (!byGuild.has(entry.guildId)) byGuild.set(entry.guildId, []);
        byGuild.get(entry.guildId)!.push(entry);
    }

    for (const [guildId, entries] of byGuild) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;

        const guildConfig = await getGuildConfig(guildId).catch(() => null);
        if (!guildConfig?.birthdayChannelId) continue;

        const channel = guild.channels.cache.get(guildConfig.birthdayChannelId);
        if (!channel) continue;

        const template = guildConfig.birthdayMessage || DEFAULT_BIRTHDAY_MESSAGE;
        const role = guildConfig.birthdayRoleId ? guild.roles.cache.get(guildConfig.birthdayRoleId) : null;

        for (const entry of entries) {
            const member = await guild.members.fetch(entry.userId).catch(() => null);
            if (!member) continue;

            const age = calculateAge(entry, year);
            await (channel as any).send({ content: formatMessage(template, member, age) }).catch(() => {});
            if (role) await member.roles.add(role).catch(() => {});

            await BirthdaySchema.updateOne({ _id: entry._id }, { $set: { lastAnnounced: year } });
        }
    }
}

export { formatMessage, checkBirthdays, DEFAULT_BIRTHDAY_MESSAGE };
