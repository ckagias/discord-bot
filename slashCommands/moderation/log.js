const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { updateGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('Manage server event logging.')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set the channel where server events will be logged.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The text channel to send logs to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('unset')
                .setDescription('Disable event logging for this server.')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
            return interaction.reply({ content: 'You do not have permission to manage server settings.', flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (sub === 'set') {
            const channel = interaction.options.getChannel('channel');

            await updateGuildConfig(interaction.guild.id, { logChannelId: channel.id });

            return interaction.editReply({ content: `Log channel set to ${channel}.` });
        }

        if (sub === 'unset') {
            await updateGuildConfig(interaction.guild.id, { logChannelId: null });

            return interaction.editReply({ content: 'Event logging has been disabled.' });
        }
    },
};
