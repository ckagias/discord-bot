const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, EmbedBuilder } = require('discord.js');
const { getGuildConfig, updateGuildConfig, ensureGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('starboard')
        .setDescription('Configure the starboard for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set the starboard channel (enables starboard automatically).')
                .addChannelOption(o =>
                    o.setName('channel')
                        .setDescription('Channel where starred messages will be reposted.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('emoji')
                .setDescription('Set the emoji that triggers the starboard (default: ⭐).')
                .addStringOption(o =>
                    o.setName('emoji')
                        .setDescription('The emoji to use (e.g. ⭐ or a custom emoji name).')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('threshold')
                .setDescription('Set the minimum number of star reactions needed to post to the starboard.')
                .addIntegerOption(o =>
                    o.setName('count')
                        .setDescription('Minimum star count (default: 3).')
                        .setMinValue(1)
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable the starboard without changing any settings.'))
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View the current starboard configuration.')),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { guild } = interaction;
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            const channel = interaction.options.getChannel('channel');
            await updateGuildConfig(guild.id, {
                starboardChannelId: channel.id,
                starboardEnabled: true,
            });
            return interaction.editReply({
                content: `Starboard enabled! Starred messages will be posted in ${channel}.`,
            });
        }

        if (sub === 'emoji') {
            const emoji = interaction.options.getString('emoji').trim();
            await updateGuildConfig(guild.id, { starboardEmoji: emoji });
            return interaction.editReply({
                content: `Starboard emoji set to **${emoji}**.`,
            });
        }

        if (sub === 'threshold') {
            const count = interaction.options.getInteger('count');
            await updateGuildConfig(guild.id, { starboardThreshold: count });
            return interaction.editReply({
                content: `Starboard threshold set to **${count}** reaction${count === 1 ? '' : 's'}.`,
            });
        }

        if (sub === 'toggle') {
            const guildData = await ensureGuildConfig(guild.id);
            guildData.starboardEnabled = !guildData.starboardEnabled;
            await guildData.save();
            const status = guildData.starboardEnabled ? '**Enabled**' : '**Disabled**';
            return interaction.editReply({
                content: `The starboard is now ${status} for **${guild.name}**.`,
            });
        }

        if (sub === 'view') {
            const config = await getGuildConfig(guild.id);
            const channel = config?.starboardChannelId
                ? guild.channels.cache.get(config.starboardChannelId)
                : null;

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setTitle('Starboard Configuration')
                .addFields(
                    { name: 'Status',    value: config?.starboardEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Channel',   value: channel ? `${channel}` : '_Not set_', inline: true },
                    { name: 'Emoji',     value: config?.starboardEmoji ?? '⭐', inline: true },
                    { name: 'Threshold', value: `${config?.starboardThreshold ?? 3} reaction${(config?.starboardThreshold ?? 3) === 1 ? '' : 's'}`, inline: true },
                    { name: 'Ignore NSFW', value: config?.starboardIgnoreNsfw !== false ? '✅ Yes' : '❌ No', inline: true },
                );

            return interaction.editReply({ embeds: [embed] });
        }
    },
};
