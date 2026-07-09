const { EmbedBuilder, MessageFlags } = require('discord.js');
const SuggestionSchema = require('../../models/SuggestionSchema');
const { getGuildConfig } = require('../../utils/guildConfig');
const { staffRow, applyStatus, capitalize } = require('../../slashCommands/utility/suggest');
const log = require('../../utils/log');
const logger = log.scope('suggest');

async function handleVote(interaction, field) {
    const suggestionId = interaction.customId.split(':')[1];
    const suggestion = await SuggestionSchema.findById(suggestionId);

    if (!suggestion || suggestion.status !== 'pending')
        return interaction.reply({ content: 'This suggestion is no longer accepting votes.', flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    const opposite = field === 'upvotes' ? 'downvotes' : 'upvotes';
    const already = suggestion[field].includes(userId);

    const update = already
        ? { $pull: { [field]: userId } }
        : { $addToSet: { [field]: userId }, $pull: { [opposite]: userId } };

    const updated = await SuggestionSchema.findByIdAndUpdate(suggestionId, update, { new: true });
    if (!updated)
        return interaction.reply({ content: 'This suggestion is no longer accepting votes.', flags: MessageFlags.Ephemeral });

    await interaction.reply({
        content: already ? 'Vote removed.' : 'Vote recorded.',
        flags: MessageFlags.Ephemeral,
    });

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .spliceFields(2, 1, { name: '👍', value: `${updated.upvotes.length}`, inline: true })
        .spliceFields(3, 1, { name: '👎', value: `${updated.downvotes.length}`, inline: true });
    await interaction.message.edit({ embeds: [embed] })
        .catch(err => logger.error('Failed to update vote counts on suggestion embed:', err));
}

function canReview(config, member) {
    const hasRole = config?.suggestApproverRoleId && member.roles.cache.has(config.suggestApproverRoleId);
    const hasManageGuild = member.permissions.has('ManageGuild');
    return Boolean(hasRole || hasManageGuild);
}

// Public message only ever shows vote buttons + this "Review" button, never the staff action
// buttons directly, so non-approvers never see Approve/Deny/Implement to begin with.
async function handleReview(interaction) {
    const suggestionId = interaction.customId.split(':')[1];
    const config = await getGuildConfig(interaction.guild.id);

    if (!canReview(config, interaction.member))
        return interaction.reply({ content: 'You do not have permission to review suggestions.', flags: MessageFlags.Ephemeral });

    const suggestion = await SuggestionSchema.findById(suggestionId);
    if (!suggestion || suggestion.status !== 'pending')
        return interaction.reply({ content: 'This suggestion has already been reviewed.', flags: MessageFlags.Ephemeral });

    return interaction.reply({ content: 'Review this suggestion:', components: [staffRow(suggestionId)], flags: MessageFlags.Ephemeral });
}

async function handleStaffAction(interaction, status) {
    const suggestionId = interaction.customId.split(':')[1];
    const config = await getGuildConfig(interaction.guild.id);

    if (!canReview(config, interaction.member))
        return interaction.reply({ content: 'You do not have permission to review suggestions.', flags: MessageFlags.Ephemeral });

    const suggestion = await SuggestionSchema.findById(suggestionId);
    if (!suggestion || suggestion.status !== 'pending')
        return interaction.reply({ content: 'This suggestion has already been reviewed.', flags: MessageFlags.Ephemeral });

    await applyStatus(interaction.client, suggestion, status, interaction.user.id);
    return interaction.reply({ content: `Suggestion marked as **${capitalize(status)}**.`, flags: MessageFlags.Ephemeral });
}

module.exports = [
    { type: 'button', prefix: 'suggest_up:', execute: (interaction) => handleVote(interaction, 'upvotes') },
    { type: 'button', prefix: 'suggest_down:', execute: (interaction) => handleVote(interaction, 'downvotes') },
    { type: 'button', prefix: 'suggest_review:', execute: handleReview },
    { type: 'button', prefix: 'suggest_approve:', execute: (interaction) => handleStaffAction(interaction, 'approved') },
    { type: 'button', prefix: 'suggest_deny:', execute: (interaction) => handleStaffAction(interaction, 'denied') },
    { type: 'button', prefix: 'suggest_implement:', execute: (interaction) => handleStaffAction(interaction, 'implemented') },
];
