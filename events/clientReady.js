const { ActivityType } = require('discord.js');
const GiveawaySchema = require('../models/GiveawaySchema');
const { endGiveaway } = require('../slashCommands/utility/giveaway');
const { restorePunishments } = require('../utils/punishments');
const GuildSchema = require('../models/GuildSchema');
const PollSchema = require('../models/PollSchema');
const { closePoll } = require('../slashCommands/fun/poll');

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        console.log(`Logged in as ${client.user.tag}`);

        const activityName = process.env.BOT_ACTIVITY_NAME;
        if (activityName) {
            const activityType = ActivityType[process.env.BOT_ACTIVITY_TYPE] ?? ActivityType.Watching;
            client.user.setPresence({
                activities: [{ name: activityName, type: activityType }],
            });
        }

        const active = await GiveawaySchema.find({ ended: false });
        for (const giveaway of active) {
            const remaining = giveaway.endsAt.getTime() - Date.now();
            if (remaining <= 0) {
                await endGiveaway(client, giveaway);
            } else {
                setTimeout(() => endGiveaway(client, giveaway), remaining);
            }
        }
        if (active.length) console.log(`[giveaway] Restored ${active.length} active giveaway(s).`);

        const activePolls = await PollSchema.find({ ended: false, endsAt: { $ne: null } });
        for (const poll of activePolls) {
            const remaining = poll.endsAt.getTime() - Date.now();
            if (remaining <= 0) {
                await closePoll(client, poll._id);
            } else {
                setTimeout(() => closePoll(client, poll._id), remaining);
            }
        }
        if (activePolls.length) console.log(`[poll] Restored ${activePolls.length} active timed poll(s).`);

        await restorePunishments(client);
        await restoreAutoroles(client);
    }
};

async function restoreAutoroles(client) {
    const configs = await GuildSchema.find({ autoroleId: { $ne: null } }).catch(() => []);
    if (!configs.length) return;

    let assigned = 0;
    for (const config of configs) {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) continue;

        const role = guild.roles.cache.get(config.autoroleId);
        if (!role) continue;

        const members = await guild.members.fetch().catch(() => null);
        if (!members) continue;

        for (const member of members.values()) {
            if (member.user.bot) continue;
            if (member.roles.cache.has(role.id)) continue;
            await member.roles.add(role).catch(err =>
                console.error(`[autorole] Failed to assign role to ${member.id}:`, err)
            );
            assigned++;
        }
    }

    if (assigned) console.log(`[autorole] Assigned missing autorole to ${assigned} member(s) on startup.`);
}