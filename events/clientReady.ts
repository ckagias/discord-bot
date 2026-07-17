import { ActivityType, Client } from 'discord.js';
const GiveawaySchema = require('../models/GiveawaySchema');
const { endGiveaway, scheduleGiveawayEnd } = require('../slashCommands/utility/giveaway');
const { restorePunishments } = require('../utils/punishments');
const { restoreLockdowns } = require('../utils/antiRaid');
const GuildSchema = require('../models/GuildSchema');
const PollSchema = require('../models/PollSchema');
const { closePoll } = require('../slashCommands/fun/poll');
const HeistSchema = require('../models/HeistSchema');
const { updateBalance } = require('../utils/economy');
const ReminderSchema = require('../models/ReminderSchema');
const { sendReminder, scheduleReminder } = require('../slashCommands/utility/remind');
const { checkBirthdays } = require('../utils/birthday');
const log = require('../utils/log');
const logger = log.scope('clientReady');
const giveawayLogger = log.scope('giveaway');
const pollLogger = log.scope('poll');
const remindLogger = log.scope('remind');
const heistLogger = log.scope('heist');
const autoroleLogger = log.scope('autorole');
const birthdayLogger = log.scope('birthday');

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client: Client) {
        logger.info(`Logged in as ${client.user.tag}`);

        // Deferred to READY so client.user.id is populated and the gateway is fully connected.
        await client.lavalink.init({ id: client.user.id, username: client.user.username });

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
                scheduleGiveawayEnd(client, giveaway, remaining);
            }
        }
        if (active.length) giveawayLogger.info(`Restored ${active.length} active giveaway(s).`);

        const activePolls = await PollSchema.find({ ended: false, endsAt: { $ne: null } });
        for (const poll of activePolls) {
            const remaining = poll.endsAt.getTime() - Date.now();
            if (remaining <= 0) {
                await closePoll(client, poll._id);
            } else {
                setTimeout(() => closePoll(client, poll._id), remaining);
            }
        }
        if (activePolls.length) pollLogger.info(`Restored ${activePolls.length} active timed poll(s).`);

        const activeReminders = await ReminderSchema.find({ sent: false });
        for (const reminder of activeReminders) {
            const remaining = reminder.remindAt.getTime() - Date.now();
            if (remaining <= 0) {
                await sendReminder(client, reminder);
            } else {
                scheduleReminder(client, reminder, remaining);
            }
        }
        if (activeReminders.length) remindLogger.info(`Restored ${activeReminders.length} active reminder(s).`);

        await cancelStaleHeists();
        await restorePunishments(client);
        await restoreLockdowns(client);
        await restoreAutoroles(client);
        scheduleBirthdayCheck(client);
    }
};

// Runs once now to cover birthdays missed while offline, then re-aligns to local midnight.
function scheduleBirthdayCheck(client: Client) {
    const runAndReschedule = async () => {
        await checkBirthdays(client).catch(err => birthdayLogger.error('Birthday check failed:', err));
        setTimeout(runAndReschedule, msUntilNextMidnight());
    };

    runAndReschedule();
}

function msUntilNextMidnight() {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return nextMidnight.getTime() - now.getTime();
}

// The in-memory setTimeout is lost on restart, so these would never resolve otherwise.
async function cancelStaleHeists() {
    const stale = await HeistSchema.find({ finished: false }).catch(() => []);
    if (!stale.length) return;

    for (const heist of stale) {
        await HeistSchema.updateOne({ _id: heist._id }, { $set: { finished: true } });
        await Promise.allSettled(heist.members.map(m => updateBalance(m.userId, heist.guildId, heist.entryFee)));
    }
    heistLogger.info(`Cancelled ${stale.length} stale heist(s) and refunded entry fees.`);
}

async function restoreAutoroles(client: Client) {
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
                autoroleLogger.error(`Failed to assign role to ${member.id}:`, err)
            );
            assigned++;
        }
    }

    if (assigned) autoroleLogger.info(`Assigned missing autorole to ${assigned} member(s) on startup.`);
}