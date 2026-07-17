import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
const { updateGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Manage member join announcements.')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set the channel and message for member join announcements.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The text channel to send welcome messages to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Custom message. Use {user} for a mention and {server} for the server name.')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('unset')
                .setDescription('Disable welcome messages for this server.')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (sub === 'set') {
            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');

            const fields: Record<string, unknown> = { welcomeChannelId: channel.id };
            if (message) fields.welcomeMessage = message;

            await updateGuildConfig(interaction.guild.id, fields);

            const preview = message ?? 'Welcome to **{server}**, {user}!';
            return interaction.editReply({
                content: `Welcome channel set to ${channel}.\nMessage: \`${preview}\``,
            });
        }

        if (sub === 'unset') {
            await updateGuildConfig(interaction.guild.id, { welcomeChannelId: null, welcomeMessage: null });

            return interaction.editReply({ content: 'Welcome messages have been disabled.' });
        }
    },
};
