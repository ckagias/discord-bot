const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const BirthdaySchema = require('../../models/BirthdaySchema');

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function isValidDate(month, day) {
    if (month < 1 || month > 12) return false;
    return day >= 1 && day <= MONTH_DAYS[month - 1];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Manage your birthday.')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set your birthday for this server.')
                .addIntegerOption(o => o.setName('month').setDescription('Birth month (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
                .addIntegerOption(o => o.setName('day').setDescription('Birth day (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
                .addIntegerOption(o => o.setName('year').setDescription('Birth year (optional, kept private)').setRequired(false).setMinValue(1900).setMaxValue(new Date().getFullYear()))
        )
        .addSubcommand(sub =>
            sub.setName('unset')
                .setDescription('Remove your saved birthday for this server.')
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View your saved birthday for this server.')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            const month = interaction.options.getInteger('month');
            const day = interaction.options.getInteger('day');
            const year = interaction.options.getInteger('year');

            if (!isValidDate(month, day)) {
                return interaction.reply({ content: `${MONTH_NAMES[month - 1] ?? 'That month'} doesn't have a day ${day}.`, flags: MessageFlags.Ephemeral });
            }

            await BirthdaySchema.findOneAndUpdate(
                { guildId: interaction.guild.id, userId: interaction.user.id },
                { $set: { month, day, year: year ?? null, lastAnnounced: null } },
                { upsert: true }
            );

            return interaction.reply({
                content: `Your birthday is set to **${MONTH_NAMES[month - 1]} ${day}**.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'unset') {
            await BirthdaySchema.deleteOne({ guildId: interaction.guild.id, userId: interaction.user.id });
            return interaction.reply({ content: 'Your birthday has been removed for this server.', flags: MessageFlags.Ephemeral });
        }

        if (sub === 'view') {
            const entry = await BirthdaySchema.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });
            if (!entry) {
                return interaction.reply({ content: "You haven't set a birthday for this server yet.", flags: MessageFlags.Ephemeral });
            }

            return interaction.reply({
                content: `Your saved birthday is **${MONTH_NAMES[entry.month - 1]} ${entry.day}**${entry.year ? ` (${entry.year})` : ''}.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
