const { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isValidUrl } = require('../utils/validate');
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
                const payload = { content: 'Error executing command', ephemeral: true };
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

        if (interaction.isButton()) {
            if (interaction.customId === 'ticket_open') {
                await handleTicketOpen(interaction);
            } else if (interaction.customId === 'ticket_close_btn') {
                await handleTicketCloseButton(interaction);
            } else if (interaction.customId === 'giveaway_enter') {
                await handleGiveawayEnter(interaction);
            }
        }
    }
};

async function handleReactionRoleSetup(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channelId = interaction.customId.split(':')[1];
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel)
        return interaction.editReply({ content: 'Could not find the channel. Please try again.' });

    const title       = interaction.fields.getTextInputValue('rr_title');
    const description = interaction.fields.getTextInputValue('rr_description');
    const colorRaw    = interaction.fields.getTextInputValue('rr_color').trim();
    const footerText  = interaction.fields.getTextInputValue('rr_footer').trim();
    const thumbnail   = interaction.fields.getTextInputValue('rr_thumbnail').trim();

    let color = Math.floor(Math.random() * 0xFFFFFF);
    if (colorRaw) {
        const parsed = parseInt(colorRaw.replace('#', ''), 16);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFFFF) color = parsed;
        else return interaction.editReply({ content: 'Invalid hex color. Use format `#5865F2`.' });
    }

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
    await interaction.deferReply({ ephemeral: true });

    const config = await GuildSchema.findOne({ guildId: interaction.guild.id });
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
        { new: true }
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
        return interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });

    const isSupport = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
    const isOwner = ticket.userId === interaction.user.id;

    if (!isSupport && !isOwner)
        return interaction.reply({ content: 'You do not have permission to close this ticket.', ephemeral: true });

    await interaction.reply({ content: `Ticket closed by ${interaction.user}. This channel will be deleted in 5 seconds.` });

    await TicketSchema.findOneAndUpdate({ channelId: interaction.channel.id }, { status: 'closed' });

    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

async function handleGiveawayEnter(interaction) {
    const giveaway = await GiveawaySchema.findOne({ messageId: interaction.message.id, ended: false });

    if (!giveaway)
        return interaction.reply({ content: 'This giveaway has already ended.', ephemeral: true });

    const userId = interaction.user.id;
    const already = giveaway.entrants.includes(userId);

    if (already) {
        giveaway.entrants = giveaway.entrants.filter(id => id !== userId);
        await giveaway.save();
        await interaction.reply({ content: 'You have withdrawn from the giveaway.', ephemeral: true });
    } else {
        giveaway.entrants.push(userId);
        await giveaway.save();
        await interaction.reply({ content: 'You have entered the giveaway! Click again to withdraw.', ephemeral: true });
    }

    const { EmbedBuilder: EB } = require('discord.js');
    const currentEmbed = interaction.message.embeds[0];
    const updated = EB.from(currentEmbed).spliceFields(3, 1, { name: 'Entries', value: `${giveaway.entrants.length}`, inline: true });
    await interaction.message.edit({ embeds: [updated] }).catch(() => {});
}