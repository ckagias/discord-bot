const { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { isValidUrl } = require('../utils/validate');
const { parseHexColor } = require('../utils/embeds');
const { getGuildConfig } = require('../utils/guildConfig');
const GuildSchema = require('../models/GuildSchema');
const TicketSchema = require('../models/TicketSchema');
const GiveawaySchema = require('../models/GiveawaySchema');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(error);
                const payload = { content: 'Error executing command', flags: MessageFlags.Ephemeral };
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(payload).catch(() => {});
                } else {
                    await interaction.reply(payload).catch(() => {});
                }
            }
            return;
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('rr_setup:')) {
            await handleReactionRoleSetup(interaction);
            return;
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('embed_create:')) {
            await handleEmbedMainModal(interaction);
            return;
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('embed_edit:')) {
            await handleEmbedMainModal(interaction);
            return;
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('embed_fields:')) {
            await handleEmbedFieldsModal(interaction);
            return;
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'ticket_open') {
                await handleTicketOpen(interaction);
            } else if (interaction.customId === 'ticket_close_btn') {
                await handleTicketCloseButton(interaction);
            } else if (interaction.customId === 'giveaway_enter') {
                await handleGiveawayEnter(interaction);
            } else if (interaction.customId.startsWith('embed_fields:')) {
                await handleEmbedFieldsButton(interaction);
            } else if (interaction.customId === 'embed_post_now') {
                await handleEmbedPostNow(interaction);
            }
        }
    }
};

async function handleReactionRoleSetup(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.customId.split(':')[1];
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel)
        return interaction.editReply({ content: 'Could not find the channel. Please try again.' });

    const title       = interaction.fields.getTextInputValue('rr_title');
    const description = interaction.fields.getTextInputValue('rr_description');
    const colorRaw    = interaction.fields.getTextInputValue('rr_color').trim();
    const footerText  = interaction.fields.getTextInputValue('rr_footer').trim();
    const thumbnail   = interaction.fields.getTextInputValue('rr_thumbnail').trim();

    const { color, error } = parseHexColor(colorRaw);
    if (error) return interaction.editReply({ content: error });

    if (thumbnail && !isValidUrl(thumbnail))
        return interaction.editReply({ content: 'Invalid thumbnail URL.' });

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);

    if (footerText) embed.setFooter({ text: footerText });
    if (thumbnail)  embed.setThumbnail(thumbnail);

    const sent = await channel.send({ embeds: [embed] });

    return interaction.editReply({
        content: `Embed posted. Message ID: \`${sent.id}\`\nUse \`/reactionrole add\` with this ID to bind emojis to roles.`,
    });
}

async function handleTicketOpen(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getGuildConfig(interaction.guild.id);
    if (!config?.ticketCategoryId || !config?.ticketSupportRoleId)
        return interaction.editReply({ content: 'The ticket system is not configured. Contact an administrator.' });

    const category = await interaction.guild.channels.fetch(config.ticketCategoryId).catch(() => null);
    if (!category)
        return interaction.editReply({ content: 'The configured ticket category no longer exists. Ask an admin to run `/ticket setup` again.' });

    const existing = await TicketSchema.findOne({ guildId: interaction.guild.id, userId: interaction.user.id, status: 'open' });
    if (existing) {
        const channel = await interaction.guild.channels.fetch(existing.channelId).catch(() => null);
        if (!channel) {
            await TicketSchema.deleteOne({ _id: existing._id });
        } else {
            return interaction.editReply({ content: `You already have an open ticket: ${channel}.` });
        }
    }

    const updated = await GuildSchema.findOneAndUpdate(
        { guildId: interaction.guild.id },
        { $inc: { ticketCount: 1 } },
        { returnDocument: 'after' }
    );
    const ticketNumber = updated.ticketCount;

    const channel = await interaction.guild.channels.create({
        name: `ticket-${String(ticketNumber).padStart(4, '0')}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: config.ticketSupportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
        ],
    });

    await TicketSchema.create({
        guildId: interaction.guild.id,
        channelId: channel.id,
        userId: interaction.user.id,
        ticketNumber,
    });

    const embed = new EmbedBuilder()
        .setTitle(`Ticket #${String(ticketNumber).padStart(4, '0')}`)
        .setDescription(`Hello ${interaction.user}, thank you for opening a ticket. Please describe your issue and a staff member will assist you shortly.`)
        .setColor(Math.floor(Math.random() * 0xFFFFFF))
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_close_btn')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
    );

    await channel.send({ content: `${interaction.user} | <@&${config.ticketSupportRoleId}>`, embeds: [embed], components: [row] });

    return interaction.editReply({ content: `Your ticket has been created: ${channel}.` });
}

async function handleTicketCloseButton(interaction) {
    const ticket = await TicketSchema.findOne({ channelId: interaction.channel.id, status: 'open' });

    if (!ticket)
        return interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral });

    const isSupport = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
    const isOwner = ticket.userId === interaction.user.id;

    if (!isSupport && !isOwner)
        return interaction.reply({ content: 'You do not have permission to close this ticket.', flags: MessageFlags.Ephemeral });

    await interaction.reply({ content: `Ticket closed by ${interaction.user}. This channel will be deleted in 5 seconds.` });

    await TicketSchema.findOneAndUpdate({ channelId: interaction.channel.id }, { status: 'closed' });

    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

async function handleEmbedMainModal(interaction) {
    const { parseMainFields } = require('../slashCommands/utility/embed');
    const { ActionRowBuilder: ARB, ButtonBuilder: BB, ButtonStyle: BS } = require('discord.js');

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

    const row = new ARB().addComponents(
        new BB()
            .setCustomId(fieldsCustomId)
            .setLabel('Add Fields (optional)')
            .setStyle(BS.Secondary)
            .setEmoji('📋'),
        new BB()
            .setCustomId('embed_post_now')
            .setLabel('Post Without Fields')
            .setStyle(BS.Primary)
            .setEmoji('✅'),
    );

    return interaction.reply({
        content: '**Step 2 — Fields (optional)**\nClick **Add Fields** to add up to 5 inline or full-width fields, or **Post Without Fields** to send the embed now.',
        components: [row],
        flags: MessageFlags.Ephemeral,
    });
}

async function getExistingFields(interaction, parts) {
    try {
        const channelId = parts[1];
        const messageId = parts[2];
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return [];
        const message = await channel.messages.fetch(messageId).catch(() => null);
        return message?.embeds[0]?.fields ?? [];
    } catch {
        return [];
    }
}

async function handleEmbedFieldsButton(interaction) {
    const { buildFieldsModal } = require('../slashCommands/utility/embed');

    const parts  = interaction.customId.split(':');
    const isEdit = parts[1] === 'edit';
    const existingFields = isEdit ? await getExistingFields(interaction, [null, parts[2], parts[3]]) : [];

    return interaction.showModal(buildFieldsModal(interaction.customId, existingFields));
}

async function handleEmbedPostNow(interaction) {
    await interaction.deferUpdate();

    const { buildEmbed } = require('../slashCommands/utility/embed');

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
        await message.edit({ embeds: [embed] });
        return interaction.editReply({ content: 'Embed updated.', components: [] });
    } else {
        const channel = await interaction.guild.channels.fetch(parts[1]).catch(() => null);
        if (!channel) return interaction.editReply({ content: 'Could not find the target channel.', components: [] });
        const sent = await channel.send({ embeds: [embed] });
        return interaction.editReply({ content: `Embed posted in ${channel}. Message ID: \`${sent.id}\``, components: [] });
    }
}

async function handleEmbedFieldsModal(interaction) {
    await interaction.deferUpdate();

    const { parseFieldLines, buildEmbed } = require('../slashCommands/utility/embed');

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
        await message.edit({ embeds: [embed] });
        return interaction.editReply({ content: 'Embed updated.', components: [] });
    } else {
        const channel = await interaction.guild.channels.fetch(parts[2]).catch(() => null);
        if (!channel) return interaction.editReply({ content: 'Could not find the target channel.', components: [] });
        const sent = await channel.send({ embeds: [embed] });
        return interaction.editReply({ content: `Embed posted in ${channel}. Message ID: \`${sent.id}\``, components: [] });
    }
}

async function handleGiveawayEnter(interaction) {
    const giveaway = await GiveawaySchema.findOne({ messageId: interaction.message.id, ended: false });

    if (!giveaway)
        return interaction.reply({ content: 'This giveaway has already ended.', flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    const already = giveaway.entrants.includes(userId);

    if (already) {
        giveaway.entrants = giveaway.entrants.filter(id => id !== userId);
        await giveaway.save();
        await interaction.reply({ content: 'You have withdrawn from the giveaway.', flags: MessageFlags.Ephemeral });
    } else {
        giveaway.entrants.push(userId);
        await giveaway.save();
        await interaction.reply({ content: 'You have entered the giveaway! Click again to withdraw.', flags: MessageFlags.Ephemeral });
    }

    const { EmbedBuilder: EB } = require('discord.js');
    const currentEmbed = interaction.message.embeds[0];
    const updated = EB.from(currentEmbed).spliceFields(3, 1, { name: 'Entries', value: `${giveaway.entrants.length}`, inline: true });
    await interaction.message.edit({ embeds: [updated] }).catch(() => {});
}