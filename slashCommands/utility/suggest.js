const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const SuggestionSchema = require('../../models/SuggestionSchema');
const { getGuildConfig, updateGuildConfig } = require('../../utils/guildConfig');

const STATUS_COLOR = {
    approved: 0x2ecc71,
    denied: 0xe74c3c,
    implemented: 0x5865f2,
};

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function suggestionEmbed(suggestion) {
    const embed = new EmbedBuilder()
        .setTitle('Suggestion')
        .setDescription(suggestion.content)
        .setColor(STATUS_COLOR[suggestion.status] ?? Math.floor(Math.random() * 0xFFFFFF))
        .addFields(
            { name: 'Submitted by', value: `<@${suggestion.authorId}>`, inline: true },
            { name: 'Status', value: capitalize(suggestion.status), inline: true },
            { name: '👍', value: `${suggestion.upvotes.length}`, inline: true },
            { name: '👎', value: `${suggestion.downvotes.length}`, inline: true },
        )
        .setTimestamp(suggestion.createdAt);

    if (suggestion.staffId) {
        embed.setFooter({ text: `${capitalize(suggestion.status)} by staff` });
    }

    return embed;
}

function voteRow(suggestionId, reviewable = true) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`suggest_up:${suggestionId}`).setLabel('Upvote').setEmoji('👍').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`suggest_down:${suggestionId}`).setLabel('Downvote').setEmoji('👎').setStyle(ButtonStyle.Secondary),
    );
    if (reviewable) {
        row.addComponents(
            new ButtonBuilder().setCustomId(`suggest_review:${suggestionId}`).setLabel('Review').setEmoji('🛠️').setStyle(ButtonStyle.Secondary),
        );
    }
    return row;
}

// Staff-only buttons: never posted to the public message, only sent ephemerally to permitted reviewers via `suggest_review:`.
function staffRow(suggestionId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`suggest_approve:${suggestionId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`suggest_deny:${suggestionId}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`suggest_implement:${suggestionId}`).setLabel('Implement').setStyle(ButtonStyle.Primary),
    );
}

async function applyStatus(client, suggestion, status, staffId) {
    suggestion.status = status;
    suggestion.staffId = staffId;
    await suggestion.save();

    const channel = await client.channels.fetch(suggestion.channelId).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(suggestion.messageId).catch(() => null);
    if (!message) return;

    const embed = suggestionEmbed(suggestion);
    await message.edit({ embeds: [embed], components: [voteRow(suggestion._id, false)] }).catch(() => {});
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggest')
        .setDescription('Submit and manage suggestions.')
        .addSubcommand(sub =>
            sub.setName('submit')
                .setDescription('Submit a suggestion for staff to review.')
                .addStringOption(o => o.setName('text').setDescription('Your suggestion').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Configure the suggestion box. (Manage Server)')
                .addChannelOption(o => o.setName('channel').setDescription('Channel suggestions are posted to').setRequired(true))
                .addRoleOption(o => o.setName('approver-role').setDescription('Role that can approve/deny/implement suggestions').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List pending suggestions in this server.')),

    // No shared `permissions` field on purpose, submit is open to everyone but setup needs Manage Server.
    suggestionEmbed,
    voteRow,
    staffRow,
    applyStatus,
    capitalize,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'submit') {
            const content = interaction.options.getString('text');
            const config = await getGuildConfig(interaction.guild.id);

            if (!config?.suggestChannelId)
                return interaction.reply({ content: 'The suggestion box is not configured. Ask an admin to run `/suggest setup`.', flags: MessageFlags.Ephemeral });

            const channel = await interaction.guild.channels.fetch(config.suggestChannelId).catch(() => null);
            if (!channel)
                return interaction.reply({ content: 'The configured suggestion channel no longer exists. Ask an admin to run `/suggest setup` again.', flags: MessageFlags.Ephemeral });

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const suggestion = await SuggestionSchema.create({
                guildId: interaction.guild.id,
                channelId: channel.id,
                messageId: 'pending',
                authorId: interaction.user.id,
                content,
            });

            const embed = suggestionEmbed(suggestion);
            const msg = await channel.send({ embeds: [embed], components: [voteRow(suggestion._id)] });

            suggestion.messageId = msg.id;
            await suggestion.save();

            return interaction.editReply({ content: `Suggestion submitted! [Jump to message](https://discord.com/channels/${interaction.guild.id}/${channel.id}/${msg.id})` });
        }

        if (sub === 'setup') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
                return interaction.reply({ content: 'You need the **Manage Server** permission.', flags: MessageFlags.Ephemeral });

            const channel = interaction.options.getChannel('channel');
            const approverRole = interaction.options.getRole('approver-role');

            await updateGuildConfig(interaction.guild.id, { suggestChannelId: channel.id, suggestApproverRoleId: approverRole.id });

            return interaction.reply({
                content: `Suggestion box configured.\n**Channel:** ${channel}\n**Approver Role:** ${approverRole}`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'list') {
            const suggestions = await SuggestionSchema.find({ guildId: interaction.guild.id, status: 'pending' }).sort({ createdAt: -1 }).limit(10);

            if (!suggestions.length)
                return interaction.reply({ content: 'No pending suggestions in this server.', flags: MessageFlags.Ephemeral });

            const lines = suggestions.map(s => {
                const jump = `https://discord.com/channels/${s.guildId}/${s.channelId}/${s.messageId}`;
                return `• ${s.content.length > 80 ? `${s.content.slice(0, 80)}…` : s.content} — 👍 ${s.upvotes.length} 👎 ${s.downvotes.length} — [Jump](${jump})`;
            });

            const embed = new EmbedBuilder()
                .setTitle('Pending Suggestions')
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription(lines.join('\n'));

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
