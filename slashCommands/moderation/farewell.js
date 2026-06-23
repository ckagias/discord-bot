const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { updateGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('farewell')
        .setDescription('Manage member leave announcements.')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set the channel and message for member leave announcements.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The text channel to send farewell messages to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Custom message. Use {user} for the username and {server} for the server name.')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('unset')
                .setDescription('Disable farewell messages for this server.')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
            return interaction.reply({ content: 'You do not have permission to manage server settings.', flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (sub === 'set') {
            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');

            const fields = { farewellChannelId: channel.id };
            if (message) fields.farewellMessage = message;

            await updateGuildConfig(interaction.guild.id, fields);

            const preview = message ?? '**{user}** has left **{server}**.';
            return interaction.editReply({
                content: `Farewell channel set to ${channel}.\nMessage: \`${preview}\``,
            });
        }

        if (sub === 'unset') {
            await updateGuildConfig(interaction.guild.id, { farewellChannelId: null, farewellMessage: null });

            return interaction.editReply({ content: 'Farewell messages have been disabled.' });
        }
    },
};
