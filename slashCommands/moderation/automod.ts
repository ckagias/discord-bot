import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
const { getGuildConfig, updateGuildConfig, ensureGuildConfig } = require('../../utils/guildConfig');
const { formatDuration } = require('../../utils/duration');

const MAX_TIMEOUT_SECONDS = 2419200; // Discord maximum: 28 days
const MAX_BANNED_WORDS = 200;

function parseDuration(str: string) {
    const match = str.match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * units[match[2].toLowerCase()];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Configure auto-moderation for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable auto-moderation entirely.'))
        .addSubcommand(sub =>
            sub.setName('filter')
                .setDescription('Enable or disable a specific filter.')
                .addStringOption(o =>
                    o.setName('name').setDescription('Filter to toggle.').setRequired(true)
                        .addChoices(
                            { name: 'Banned Words', value: 'automodBannedWords' },
                            { name: 'Spam/Flood',   value: 'automodSpam' },
                            { name: 'Mentions',     value: 'automodMentions' },
                            { name: 'Invite Links', value: 'automodInvites' },
                        )))
        .addSubcommand(sub =>
            sub.setName('action')
                .setDescription('Set what happens when a message is filtered.')
                .addStringOption(o =>
                    o.setName('type').setDescription('Action to take.').setRequired(true)
                        .addChoices(
                            { name: 'Delete only', value: 'delete' },
                            { name: 'Delete + Warn', value: 'warn' },
                            { name: 'Delete + Timeout', value: 'timeout' },
                        ))
                .addStringOption(o =>
                    o.setName('duration').setDescription('Timeout duration (e.g. 5m, 1h) — required for the timeout action.').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('mentionlimit')
                .setDescription('Set the max mentions allowed per message before it is filtered.')
                .addIntegerOption(o =>
                    o.setName('count').setDescription('Mention limit (default 5).').setMinValue(1).setRequired(true)))
        .addSubcommandGroup(group =>
            group.setName('word')
                .setDescription('Manage the banned word list.')
                .addSubcommand(sub =>
                    sub.setName('add')
                        .setDescription('Add a word to the banned word list.')
                        .addStringOption(o => o.setName('word').setDescription('Word to ban.').setMaxLength(100).setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('remove')
                        .setDescription('Remove a word from the banned word list.')
                        .addStringOption(o => o.setName('word').setDescription('Word to unban.').setMaxLength(100).setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('list')
                        .setDescription('List all banned words.')))
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View the current auto-moderation configuration.')),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { guild } = interaction;
        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();

        if (group === 'word') {
            const guildData = await ensureGuildConfig(guild.id);
            const wordList = guildData.automodBannedWordList ?? [];

            if (sub === 'add') {
                const word = interaction.options.getString('word').trim().toLowerCase();
                if (!word) return interaction.editReply({ content: 'Please provide a valid word.' });
                if (wordList.includes(word)) return interaction.editReply({ content: `**${word}** is already banned.` });
                if (wordList.length >= MAX_BANNED_WORDS) {
                    return interaction.editReply({ content: `Banned word list is capped at ${MAX_BANNED_WORDS} words.` });
                }

                await updateGuildConfig(guild.id, { automodBannedWordList: [...wordList, word] });
                return interaction.editReply({ content: `Added **${word}** to the banned word list.` });
            }

            if (sub === 'remove') {
                const word = interaction.options.getString('word').trim().toLowerCase();
                if (!wordList.includes(word)) return interaction.editReply({ content: `**${word}** is not in the banned word list.` });

                await updateGuildConfig(guild.id, { automodBannedWordList: wordList.filter((w: string) => w !== word) });
                return interaction.editReply({ content: `Removed **${word}** from the banned word list.` });
            }

            if (sub === 'list') {
                if (!wordList.length) return interaction.editReply({ content: 'No banned words configured.' });

                const embed = new EmbedBuilder()
                    .setTitle('Banned Words')
                    .setColor(Math.floor(Math.random() * 0xFFFFFF))
                    .setDescription(wordList.map((w: string) => `\`${w}\``).join(', '));
                return interaction.editReply({ embeds: [embed] });
            }
            return;
        }

        if (sub === 'toggle') {
            const guildData = await ensureGuildConfig(guild.id);
            const enabled = !guildData.automodEnabled;
            await updateGuildConfig(guild.id, { automodEnabled: enabled });
            const status = enabled ? '**Enabled**' : '**Disabled**';
            return interaction.editReply({ content: `Auto-moderation is now ${status} for **${guild.name}**.` });
        }

        if (sub === 'filter') {
            const name = interaction.options.getString('name');
            const guildData = await ensureGuildConfig(guild.id);
            const enabled = !guildData[name];
            await updateGuildConfig(guild.id, { [name]: enabled });

            const labels: Record<string, string> = {
                automodBannedWords: 'Banned Words',
                automodSpam: 'Spam/Flood',
                automodMentions: 'Mentions',
                automodInvites: 'Invite Links',
            };
            const status = enabled ? '**enabled**' : '**disabled**';
            return interaction.editReply({ content: `${labels[name]} filter is now ${status}.` });
        }

        if (sub === 'action') {
            const type = interaction.options.getString('type');
            const durStr = interaction.options.getString('duration');

            const update: Record<string, unknown> = { automodAction: type };

            if (type === 'timeout') {
                if (!durStr) {
                    return interaction.editReply({ content: 'A duration is required for the timeout action (e.g. `5m`, `1h`, `1d`).' });
                }
                const duration = parseDuration(durStr);
                if (!duration) {
                    return interaction.editReply({ content: 'Invalid duration format. Use a number followed by `s`, `m`, `h`, or `d` (e.g. `5m`).' });
                }
                if (duration > MAX_TIMEOUT_SECONDS) {
                    return interaction.editReply({ content: 'Timeout duration cannot exceed 28 days.' });
                }
                update.automodTimeoutSeconds = duration;
            }

            await updateGuildConfig(guild.id, update);

            const label = type === 'timeout'
                ? `Delete + Timeout (${formatDuration((update.automodTimeoutSeconds as number) * 1000)})`
                : type === 'warn' ? 'Delete + Warn' : 'Delete only';
            return interaction.editReply({ content: `Auto-mod action set to **${label}**.` });
        }

        if (sub === 'mentionlimit') {
            const count = interaction.options.getInteger('count');
            await updateGuildConfig(guild.id, { automodMentionLimit: count });
            return interaction.editReply({ content: `Mention limit set to **${count}**.` });
        }

        if (sub === 'view') {
            const config = await getGuildConfig(guild.id);
            const wordList = config?.automodBannedWordList ?? [];
            const actionLabels: Record<string, string> = { delete: 'Delete only', warn: 'Delete + Warn', timeout: 'Delete + Timeout' };
            const action = config?.automodAction ?? 'delete';

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setTitle('Auto-Moderation Configuration')
                .addFields(
                    { name: 'Status', value: config?.automodEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Action', value: actionLabels[action] + (action === 'timeout' ? ` (${formatDuration((config?.automodTimeoutSeconds ?? 300) * 1000)})` : ''), inline: true },
                    { name: 'Banned Words', value: config?.automodBannedWords ? `✅ Enabled (${wordList.length} word${wordList.length === 1 ? '' : 's'})` : '❌ Disabled', inline: true },
                    { name: 'Spam/Flood', value: config?.automodSpam ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Mentions', value: config?.automodMentions ? `✅ Enabled (limit ${config?.automodMentionLimit ?? 5})` : '❌ Disabled', inline: true },
                    { name: 'Invite Links', value: config?.automodInvites ? '✅ Enabled' : '❌ Disabled', inline: true },
                );

            return interaction.editReply({ embeds: [embed] });
        }
    },
};
