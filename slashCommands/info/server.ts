import { SlashCommandBuilder, EmbedBuilder, ChannelType, MessageFlags, ChatInputCommandInteraction } from 'discord.js';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Show server information and assets.')
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Display information about the server'))
        .addSubcommand(sub =>
            sub.setName('icon')
                .setDescription("Show the server's icon"))
        .addSubcommand(sub =>
            sub.setName('banner')
                .setDescription("Show the server's banner")),

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;

        if (sub === 'info') {
            const channels = await guild.channels.fetch();

            const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
            const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
            const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;
            const stageChannels = channels.filter(c => c.type === ChannelType.GuildStageVoice).size;
            const newsChannels = channels.filter(c => c.type === ChannelType.GuildAnnouncement).size;
            const threadChannels = channels.filter(c => c && [ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(c.type)).size;
            const totalChannels = textChannels + voiceChannels + threadChannels + categories + stageChannels + newsChannels;

            const bots = guild.members.cache.filter(member => member.user.bot).size;
            const humans = guild.memberCount - bots;

            const embed = new EmbedBuilder()
                .setTitle('Server Information')
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setThumbnail(guild.iconURL({ dynamic: true } as any))
                .addFields(
                    {
                        name: '🛡️ | General',
                        value: `➥ **Owner:** <@${guild.ownerId}>\n➥ **Name:** ${guild.name}\n➥ **Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n➥ **Verification:** ${guild.verificationLevel}\n➥ **Boosts:** ${guild.premiumSubscriptionCount}`
                    },
                    {
                        name: '👥 | Members',
                        value: `➥ **Total:** ${guild.memberCount}\n➥ **Humans:** ${humans}\n➥ **Bots:** ${bots}`
                    },
                    {
                        name: '🎭 | Roles',
                        value: `➥ **Total Roles:** ${guild.roles.cache.size}`
                    },
                    {
                        name: '💬 | Channels',
                        value: `➥ **Text:** ${textChannels}\n➥ **Voice:** ${voiceChannels}\n➥ **Threads:** ${threadChannels}\n➥ **Categories:** ${categories}\n➥ **Stages:** ${stageChannels}\n➥ **News:** ${newsChannels}\n\n➥ **Total:** ${totalChannels}`
                    },
                    {
                        name: '😎 | Assets',
                        value: `➥ **Animated:** ${guild.emojis.cache.filter(e => e.animated).size}\n➥ **Static:** ${guild.emojis.cache.filter(e => !e.animated).size}\n➥ **Stickers:** ${guild.stickers.cache.size}`
                    }
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'icon') {
            const icon = guild.iconURL({ size: 4096, dynamic: true } as any);
            if (!icon) return interaction.reply({ content: 'This server has no icon.', flags: MessageFlags.Ephemeral });

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setTitle(`${guild.name} — Icon`)
                .setDescription(`[png](${guild.iconURL({ size: 2048, extension: 'png' })}) | [jpg](${guild.iconURL({ size: 2048, extension: 'jpg' })}) | [webp](${guild.iconURL({ size: 2048, extension: 'webp' })})`)
                .setImage(icon)
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'banner') {
            const banner = guild.bannerURL({ size: 4096, dynamic: true } as any);
            if (!banner) return interaction.reply({ content: 'This server has no banner. Banners require a boosted server (level 2+).', flags: MessageFlags.Ephemeral });

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setTitle(`${guild.name} — Banner`)
                .setDescription(`[png](${guild.bannerURL({ size: 2048, extension: 'png' })}) | [jpg](${guild.bannerURL({ size: 2048, extension: 'jpg' })}) | [webp](${guild.bannerURL({ size: 2048, extension: 'webp' })})`)
                .setImage(banner)
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    },
};
