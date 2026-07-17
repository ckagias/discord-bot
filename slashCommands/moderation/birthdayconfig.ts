import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
const { updateGuildConfig } = require('../../utils/guildConfig');
const { DEFAULT_BIRTHDAY_MESSAGE } = require('../../utils/birthday');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('birthdayconfig')
        .setDescription('Configure birthday announcements for this server.')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set the channel, message, and optional role for birthday announcements.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The text channel to post birthday announcements in')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Custom message. Use {user}, {server}, and {age} (age turned, if birth year was given).')
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to grant for the day (removed automatically the next day)')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('unset')
                .setDescription('Disable birthday announcements for this server.')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (sub === 'set') {
            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');
            const role = interaction.options.getRole('role');

            const fields: Record<string, unknown> = { birthdayChannelId: channel.id };
            if (message) fields.birthdayMessage = message;
            if (role) fields.birthdayRoleId = role.id;

            await updateGuildConfig(interaction.guild.id, fields);

            const preview = message ?? DEFAULT_BIRTHDAY_MESSAGE;
            return interaction.editReply({
                content: `Birthday channel set to ${channel}.\nMessage: \`${preview}\`${role ? `\nRole: ${role}` : ''}`,
            });
        }

        if (sub === 'unset') {
            await updateGuildConfig(interaction.guild.id, { birthdayChannelId: null, birthdayMessage: null, birthdayRoleId: null });

            return interaction.editReply({ content: 'Birthday announcements have been disabled.' });
        }
    },
};
