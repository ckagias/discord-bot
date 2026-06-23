const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const TicketSchema = require('../../models/TicketSchema');
const { getGuildConfig, updateGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage the ticket system.')
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Configure the ticket system. (Manage Server)')
                .addChannelOption(option =>
                    option.setName('category')
                        .setDescription('Category where ticket channels will be created')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('support-role')
                        .setDescription('Role that can see and manage tickets')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('Post the ticket panel in this channel. (Manage Server)')
        )
        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('Close the current ticket channel.')
        )
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('Show ticket statistics for this server. (Manage Server)')
        )
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Reset the ticket counter to 0 and clear all records. (Administrator)')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'setup') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
                return interaction.reply({ content: 'You need the **Manage Server** permission.', flags: MessageFlags.Ephemeral });

            const category = interaction.options.getChannel('category');
            const supportRole = interaction.options.getRole('support-role');

            await updateGuildConfig(interaction.guild.id, { ticketCategoryId: category.id, ticketSupportRoleId: supportRole.id });

            return interaction.reply({
                content: `Ticket system configured.\n**Category:** ${category.name}\n**Support Role:** ${supportRole}`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'panel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
                return interaction.reply({ content: 'You need the **Manage Server** permission.', flags: MessageFlags.Ephemeral });

            const config = await getGuildConfig(interaction.guild.id);

            if (!config?.ticketCategoryId || !config?.ticketSupportRoleId)
                return interaction.reply({ content: 'Ticket system is not configured. Run `/ticket setup` first.', flags: MessageFlags.Ephemeral });

            const embed = new EmbedBuilder()
                .setTitle('Support Tickets')
                .setDescription('Click the button below to open a support ticket. Our team will assist you as soon as possible.')
                .setColor(Math.floor(Math.random() * 0xFFFFFF));

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_open')
                    .setLabel('Open Ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫')
            );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: 'Ticket panel posted.', flags: MessageFlags.Ephemeral });
        }

        if (sub === 'close') {
            const ticket = await TicketSchema.findOne({ channelId: interaction.channel.id, status: 'open' });

            if (!ticket)
                return interaction.reply({ content: 'This command can only be used inside an open ticket channel.', flags: MessageFlags.Ephemeral });

            const isSupport = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
            const isOwner = ticket.userId === interaction.user.id;

            if (!isSupport && !isOwner)
                return interaction.reply({ content: 'You do not have permission to close this ticket.', flags: MessageFlags.Ephemeral });

            await interaction.reply({ content: `Ticket closed by ${interaction.user}. This channel will be deleted in 5 seconds.` });
            await TicketSchema.findOneAndUpdate({ channelId: interaction.channel.id }, { status: 'closed' });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }

        if (sub === 'stats') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
                return interaction.reply({ content: 'You need the **Manage Server** permission.', flags: MessageFlags.Ephemeral });

            const [config, open, closed] = await Promise.all([
                getGuildConfig(interaction.guild.id),
                TicketSchema.countDocuments({ guildId: interaction.guild.id, status: 'open' }),
                TicketSchema.countDocuments({ guildId: interaction.guild.id, status: 'closed' }),
            ]);

            const embed = new EmbedBuilder()
                .setTitle('Ticket Statistics')
                .addFields(
                    { name: 'Total Created', value: `${config?.ticketCount ?? 0}`, inline: true },
                    { name: 'Currently Open', value: `${open}`, inline: true },
                    { name: 'Closed', value: `${closed}`, inline: true },
                )
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (sub === 'reset') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                return interaction.reply({ content: 'You need the **Administrator** permission.', flags: MessageFlags.Ephemeral });

            await Promise.all([
                updateGuildConfig(interaction.guild.id, { ticketCount: 0 }),
                TicketSchema.deleteMany({ guildId: interaction.guild.id }),
            ]);

            return interaction.reply({ content: 'Ticket counter reset. The next ticket will be `#0001`.', flags: MessageFlags.Ephemeral });
        }
    },
};