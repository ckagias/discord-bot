const { ActivityType } = require('discord.js');
const GiveawaySchema = require('../models/GiveawaySchema');
const { endGiveaway } = require('../slashCommands/utility/giveaway');
const { restorePunishments } = require('../utils/punishments');

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

        await restorePunishments(client);
    }
};