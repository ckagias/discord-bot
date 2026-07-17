import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
const { getGuildConfig, updateGuildConfig } = require('../../utils/guildConfig');
const { formatDuration: formatMsDuration } = require('../../utils/duration');

const ACTION_LABELS: Record<string, string> = { timeout: 'Timeout', kick: 'Kick', ban: 'Ban' };

function formatDuration(seconds: number) {
    if (!seconds) return '—';
    return formatMsDuration(seconds * 1000);
}

function parseDuration(str: string) {
    const match = str.match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * units[match[2].toLowerCase()];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnthreshold')
        .setDescription('Configure automatic punishments that trigger at a warning count.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Add or update a threshold (replaces an existing one at the same count).')
                .addIntegerOption(o =>
                    o.setName('count').setDescription('Warning count that triggers this action.').setRequired(true).setMinValue(1))
                .addStringOption(o =>
                    o.setName('action').setDescription('Action to take.').setRequired(true)
                        .addChoices(
                            { name: 'Timeout', value: 'timeout' },
                            { name: 'Kick',    value: 'kick' },
                            { name: 'Ban',     value: 'ban' },
                        ))
                .addStringOption(o =>
                    o.setName('duration').setDescription('Timeout duration (e.g. 30m, 2h, 1d) — required for timeout action.').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove the threshold at a specific warning count.')
                .addIntegerOption(o =>
                    o.setName('count').setDescription('Warning count to remove.').setRequired(true).setMinValue(1)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show all configured thresholds for this server.')),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const guildData = await getGuildConfig(interaction.guild.id);
        const thresholds = guildData?.warnThresholds ?? [];

        if (sub === 'list') {
            if (thresholds.length === 0) {
                return interaction.editReply({ content: 'No warn thresholds configured. Use `/warnthreshold set` to add one.' });
            }

            const sorted = [...thresholds].sort((a, b) => a.count - b.count);
            const embed = new EmbedBuilder()
                .setTitle('Warn Thresholds')
                .setColor(0xFFA500)
                .setDescription(
                    sorted.map(t =>
                        `**${t.count} warning${t.count === 1 ? '' : 's'}** → ${ACTION_LABELS[t.action]}` +
                        (t.action === 'timeout' ? ` (${formatDuration(t.duration)})` : '')
                    ).join('\n')
                );
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'set') {
            const count    = interaction.options.getInteger('count');
            const action   = interaction.options.getString('action');
            const durStr   = interaction.options.getString('duration');

            let duration = null;
            if (action === 'timeout') {
                if (!durStr) {
                    return interaction.editReply({ content: 'A duration is required for the timeout action (e.g. `30m`, `2h`, `1d`).' });
                }
                duration = parseDuration(durStr);
                if (!duration) {
                    return interaction.editReply({ content: 'Invalid duration format. Use a number followed by `s`, `m`, `h`, or `d` (e.g. `30m`).' });
                }
                // Discord's max timeout is 28 days
                if (duration > 2419200) {
                    return interaction.editReply({ content: 'Timeout duration cannot exceed 28 days.' });
                }
            }

            const updated = thresholds.filter((t: any) => t.count !== count);
            updated.push({ count, action, duration });

            await updateGuildConfig(interaction.guild.id, { warnThresholds: updated });

            const label = action === 'timeout' ? `Timeout (${formatDuration(duration)})` : ACTION_LABELS[action];
            return interaction.editReply({
                content: `Threshold set: **${count} warning${count === 1 ? '' : 's'}** → **${label}**`,
            });
        }

        if (sub === 'remove') {
            const count = interaction.options.getInteger('count');
            const exists = thresholds.some((t: any) => t.count === count);

            if (!exists) {
                return interaction.editReply({ content: `No threshold found at **${count}** warning${count === 1 ? '' : 's'}.` });
            }

            await updateGuildConfig(interaction.guild.id, {
                warnThresholds: thresholds.filter((t: any) => t.count !== count),
            });

            return interaction.editReply({ content: `Removed threshold at **${count}** warning${count === 1 ? '' : 's'}.` });
        }
    },
};
