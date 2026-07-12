const { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getGuildConfig } = require('../../utils/guildConfig');
const GuildSchema = require('../../models/GuildSchema');
const TicketSchema = require('../../models/TicketSchema');

module.exports = {
    type: 'button',
    id: 'ticket_open',

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const config = await getGuildConfig(interaction.guild.id);
        if (!config?.ticketCategoryId || !config?.ticketSupportRoleId)
            return interaction.editReply({ content: 'The ticket system is not configured. Contact an administrator.' });

        const category = await interaction.guild.channels.fetch(config.ticketCategoryId).catch(() => null);
        if (!category)
            return interaction.editReply({ content: 'The configured ticket category no longer exists. Ask an admin to run `/ticket setup` again.' });

        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
        if (!isStaff) {
            const existing = await TicketSchema.findOne({ guildId: interaction.guild.id, userId: interaction.user.id, status: 'open' });
            if (existing) {
                const channel = await interaction.guild.channels.fetch(existing.channelId).catch(() => null);
                if (!channel) {
                    await TicketSchema.deleteOne({ _id: existing._id });
                } else {
                    return interaction.editReply({ content: `You already have an open ticket: ${channel}.` });
                }
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
    },
};
