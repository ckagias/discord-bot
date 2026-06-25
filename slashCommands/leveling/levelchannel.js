const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { getGuildConfig, updateGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('levelchannel')
        .setDescription('Set or reset the channel where level-up announcements are posted.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Send level-up announcements to a specific channel.')
                .addChannelOption(o =>
                    o.setName('channel')
                        .setDescription('Channel to post level-up messages in.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Remove the dedicated level-up channel (announcements post where the user chatted).')),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            const channel = interaction.options.getChannel('channel');
            await updateGuildConfig(interaction.guild.id, { levelUpChannelId: channel.id });
            return interaction.editReply({ content: `Level-up announcements will now post in ${channel}.` });
        }

        if (sub === 'reset') {
            await updateGuildConfig(interaction.guild.id, { levelUpChannelId: null });
            return interaction.editReply({ content: 'Level-up announcements will now post in the channel where the member chatted.' });
        }
    },
};
