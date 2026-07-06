const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const ReminderSchema = require('../../models/ReminderSchema');

const MAX_ACTIVE_PER_USER = 25;
// setTimeout's delay is a 32-bit signed int internally; anything larger overflows and fires almost
// immediately, so long waits are re-armed in chunks no larger than this.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

const activeTimers = new Map();

function parseDuration(str) {
    const match = str.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * units[match[2]];
}

async function sendReminder(client, reminder) {
    activeTimers.delete(String(reminder._id));

    const update = await ReminderSchema.updateOne({ _id: reminder._id, sent: false }, { $set: { sent: true } });
    if (update.modifiedCount === 0) return;

    const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('⏰ Reminder')
        .setColor(Math.floor(Math.random() * 0xFFFFFF))
        .setDescription(reminder.message)
        .setTimestamp();

    await channel.send({ content: `<@${reminder.userId}>`, embeds: [embed] }).catch(() => {});
}

// Schedules a reminder, re-arming in MAX_TIMEOUT_MS-sized chunks so waits longer than
// ~24.8 days don't overflow setTimeout's delay and fire immediately.
function scheduleReminder(client, reminder, remaining) {
    const id = String(reminder._id);

    if (remaining > MAX_TIMEOUT_MS) {
        const timer = setTimeout(() => scheduleReminder(client, reminder, remaining - MAX_TIMEOUT_MS), MAX_TIMEOUT_MS);
        activeTimers.set(id, timer);
        return;
    }

    const timer = setTimeout(() => sendReminder(client, reminder), Math.max(remaining, 0));
    activeTimers.set(id, timer);
}

function cancelScheduledReminder(id) {
    const timer = activeTimers.get(String(id));
    if (timer) {
        clearTimeout(timer);
        activeTimers.delete(String(id));
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Set a personal reminder.')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set a new reminder.')
                .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 2h, 1d').setRequired(true))
                .addStringOption(o => o.setName('message').setDescription('What should I remind you about?').setMaxLength(500).setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List your active reminders.'))
        .addSubcommand(sub =>
            sub.setName('cancel')
                .setDescription('Cancel a reminder.')
                .addStringOption(o => o.setName('id').setDescription('Reminder ID from /remind list').setRequired(true))),

    sendReminder,
    scheduleReminder,

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            if (!interaction.guild) {
                return interaction.reply({ content: 'Reminders can only be set in a server, not in DMs.', flags: MessageFlags.Ephemeral });
            }

            const durationStr = interaction.options.getString('duration');
            const message = interaction.options.getString('message').trim();

            const ms = parseDuration(durationStr);
            if (!ms) return interaction.reply({ content: 'Invalid duration. Use formats like `10m`, `2h`, `1d`.', flags: MessageFlags.Ephemeral });
            if (ms < 10000) return interaction.reply({ content: 'Duration must be at least 10 seconds.', flags: MessageFlags.Ephemeral });
            if (ms > 90 * 86400000) return interaction.reply({ content: 'Duration must be at most 90 days.', flags: MessageFlags.Ephemeral });

            const activeCount = await ReminderSchema.countDocuments({ userId: interaction.user.id, sent: false });
            if (activeCount >= MAX_ACTIVE_PER_USER) {
                return interaction.reply({ content: `You already have ${MAX_ACTIVE_PER_USER} active reminders. Cancel some with \`/remind cancel\` first.`, flags: MessageFlags.Ephemeral });
            }

            const remindAt = new Date(Date.now() + ms);

            const reminder = await ReminderSchema.create({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                channelId: interaction.channel.id,
                message,
                remindAt,
            });

            scheduleReminder(client, reminder, ms);

            return interaction.reply({
                content: `Got it! I'll remind you <t:${Math.floor(remindAt.getTime() / 1000)}:R>.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'list') {
            const reminders = await ReminderSchema.find({ userId: interaction.user.id, sent: false }).sort({ remindAt: 1 });

            if (!reminders.length) {
                return interaction.reply({ content: 'You have no active reminders.', flags: MessageFlags.Ephemeral });
            }

            const lines = reminders.map(r => `• \`${r._id}\` — ${r.message} — <t:${Math.floor(r.remindAt.getTime() / 1000)}:R>`);

            let description = lines.join('\n');
            if (description.length > 4096) {
                description = description.slice(0, 4093) + '...';
            }

            const embed = new EmbedBuilder()
                .setTitle('⏰ Your Reminders')
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription(description);

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (sub === 'cancel') {
            const id = interaction.options.getString('id').trim();

            const result = await ReminderSchema.deleteOne({ _id: id, userId: interaction.user.id, sent: false }).catch(() => null);
            if (!result || result.deletedCount === 0) {
                return interaction.reply({ content: 'No active reminder found with that ID.', flags: MessageFlags.Ephemeral });
            }

            cancelScheduledReminder(id);

            return interaction.reply({ content: 'Reminder cancelled.', flags: MessageFlags.Ephemeral });
        }
    },
};
