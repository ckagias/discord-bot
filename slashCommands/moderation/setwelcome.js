const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildSchema = require('../../models/GuildSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setwelcome')
        .setDescription('Set the channel and message for member join announcements.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The text channel to send welcome messages to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Custom message. Use {user} for a mention and {server} for the server name.')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');

        const update = { $set: { welcomeChannelId: channel.id }, $setOnInsert: { guildId: interaction.guild.id } };
        if (message) update.$set.welcomeMessage = message;

        await GuildSchema.findOneAndUpdate(
            { guildId: interaction.guild.id },
            update,
            { upsert: true }
        );

        const preview = message ?? 'Welcome to **{server}**, {user}!';
        return interaction.editReply({
            content: `Welcome channel set to ${channel}.\nMessage: \`${preview}\``,
        });
    },
};