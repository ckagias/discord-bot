const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const log = require('../../utils/log');
const logger = log.scope('embedBuilder');

async function handleMainModal(interaction) {
    const { parseMainFields } = require('../../slashCommands/utility/embed');

    const isEdit = interaction.customId.startsWith('embed_edit:');
    const parts  = interaction.customId.split(':');

    const result = parseMainFields(interaction);
    if (result.error) return interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });

    if (!interaction.client.embedDrafts) interaction.client.embedDrafts = new Map();

    const draftKey = interaction.user.id;
    interaction.client.embedDrafts.set(draftKey, { result, originalId: interaction.customId });
    setTimeout(() => interaction.client.embedDrafts.delete(draftKey), 600_000);

    const fieldsCustomId = isEdit
        ? `embed_fields:edit:${parts[1]}:${parts[2]}`
        : `embed_fields:create:${parts[1]}`;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(fieldsCustomId)
            .setLabel('Add Fields (optional)')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋'),
        new ButtonBuilder()
            .setCustomId('embed_post_now')
            .setLabel('Post Without Fields')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✅'),
    );

    return interaction.reply({
        content: '**Step 2 — Fields (optional)**\nClick **Add Fields** to add up to 5 inline or full-width fields, or **Post Without Fields** to send the embed now.',
        components: [row],
        flags: MessageFlags.Ephemeral,
    });
}

async function getExistingFields(interaction, channelId, messageId) {
    try {
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return [];
        const message = await channel.messages.fetch(messageId).catch(() => null);
        return message?.embeds[0]?.fields ?? [];
    } catch {
        return [];
    }
}

async function handleFieldsButton(interaction) {
    const { buildFieldsModal } = require('../../slashCommands/utility/embed');

    const parts  = interaction.customId.split(':');
    const isEdit = parts[1] === 'edit';
    const existingFields = isEdit ? await getExistingFields(interaction, parts[2], parts[3]) : [];

    return interaction.showModal(buildFieldsModal(interaction.customId, existingFields));
}

async function handleFieldsModal(interaction) {
    await interaction.deferUpdate();

    const { parseFieldLines, buildEmbed } = require('../../slashCommands/utility/embed');

    const draftKey = interaction.user.id;
    const draft = interaction.client.embedDrafts?.get(draftKey);
    if (!draft) return interaction.editReply({ content: 'Your embed draft expired. Please run `/embed create` again.', components: [] });

    interaction.client.embedDrafts.delete(draftKey);

    const fields = parseFieldLines(interaction);
    const embed  = buildEmbed(draft.result, fields);

    const parts  = interaction.customId.split(':');
    const isEdit = parts[1] === 'edit';

    if (isEdit) {
        const channel = await interaction.guild.channels.fetch(parts[2]).catch(() => null);
        const message = await channel?.messages.fetch(parts[3]).catch(() => null);
        if (!message) return interaction.editReply({ content: 'Could not find the original message.', components: [] });
        try {
            await message.edit({ embeds: [embed] });
        } catch (err) {
            logger.error('message.edit failed:', err);
            return interaction.editReply({ content: 'Failed to edit the message. Check my permissions in that channel.', components: [] });
        }
        return interaction.editReply({ content: 'Embed updated.', components: [] });
    } else {
        const channel = await interaction.guild.channels.fetch(parts[2]).catch(() => null);
        if (!channel) return interaction.editReply({ content: 'Could not find the target channel.', components: [] });
        try {
            const sent = await channel.send({ embeds: [embed] });
            return interaction.editReply({ content: `Embed posted in ${channel}. Message ID: \`${sent.id}\``, components: [] });
        } catch (err) {
            logger.error('channel.send failed:', err);
            return interaction.editReply({ content: 'Failed to post the embed. Check my permissions in that channel.', components: [] });
        }
    }
}

async function handlePostNow(interaction) {
    await interaction.deferUpdate();

    const { buildEmbed } = require('../../slashCommands/utility/embed');

    const draft = interaction.client.embedDrafts?.get(interaction.user.id);
    if (!draft) return interaction.editReply({ content: 'Your embed draft expired. Please run `/embed create` again.', components: [] });

    interaction.client.embedDrafts.delete(interaction.user.id);

    const embed = buildEmbed(draft.result, []);

    const parts  = draft.originalId.split(':');
    const isEdit = draft.originalId.startsWith('embed_edit:');

    if (isEdit) {
        const channel = await interaction.guild.channels.fetch(parts[1]).catch(() => null);
        const message = await channel?.messages.fetch(parts[2]).catch(() => null);
        if (!message) return interaction.editReply({ content: 'Could not find the original message.', components: [] });
        try {
            await message.edit({ embeds: [embed] });
        } catch (err) {
            logger.error('message.edit failed:', err);
            return interaction.editReply({ content: 'Failed to edit the message. Check my permissions in that channel.', components: [] });
        }
        return interaction.editReply({ content: 'Embed updated.', components: [] });
    } else {
        const channel = await interaction.guild.channels.fetch(parts[1]).catch(() => null);
        if (!channel) return interaction.editReply({ content: 'Could not find the target channel.', components: [] });
        try {
            const sent = await channel.send({ embeds: [embed] });
            return interaction.editReply({ content: `Embed posted in ${channel}. Message ID: \`${sent.id}\``, components: [] });
        } catch (err) {
            logger.error('channel.send failed:', err);
            return interaction.editReply({ content: 'Failed to post the embed. Check my permissions in that channel.', components: [] });
        }
    }
}

// One customId prefix can map to either a modal or a button submit depending on interaction type,
// so this module registers multiple component entries sharing the handlers above.
module.exports = [
    { type: 'modal', prefix: 'embed_create:', execute: handleMainModal },
    { type: 'modal', prefix: 'embed_edit:', execute: handleMainModal },
    { type: 'modal', prefix: 'embed_fields:', execute: handleFieldsModal },
    { type: 'button', prefix: 'embed_fields:', execute: handleFieldsButton },
    { type: 'button', id: 'embed_post_now', execute: handlePostNow },
];
