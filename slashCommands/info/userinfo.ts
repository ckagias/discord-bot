import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Shows detailed information about a user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to look up')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const fetchedUser = await user.fetch();
        const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

        const createdAt = `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`;
        const joinedAt = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'N/A';

        const roles = member
            ? member.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `${r}`)
                .join(', ') || 'None'
            : 'N/A';

        const flags = fetchedUser.flags?.toArray();
        const badges = flags?.length ? flags.map(f => f.replace(/_/g, ' ')).join(', ') : 'None';

        const statusEmoji: Record<string, string> = { online: '🟢', idle: '🟡', dnd: '🔴', offline: '⚫' };
        const presence = member?.presence;
        const status = presence?.status ?? 'offline';
        const activity = presence?.activities?.[0];
        const activityLine = activity
            ? `${activity.type === 0 ? 'Playing' : activity.type === 1 ? 'Streaming' : activity.type === 2 ? 'Listening to' : activity.type === 4 ? 'Custom:' : 'Watching'} **${activity.name}**`
            : null;

        const voiceChannel = member?.voice?.channel;
        const voiceLine = voiceChannel
            ? `${voiceChannel} ${member.voice.mute ? '🔇' : ''}${member.voice.deaf ? '🔕' : ''}`.trim()
            : 'Not in a voice channel';

        const boostingSince = member?.premiumSinceTimestamp
            ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:D>`
            : null;

        const joinPosition = member
            ? await interaction.guild.members.fetch()
                .then(members => members
                    .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
                    .map(m => m.id)
                    .indexOf(user.id) + 1)
                .catch(() => null)
            : null;

        const embed = new EmbedBuilder()
            .setColor(fetchedUser.accentColor ?? Math.floor(Math.random() * 0xFFFFFF))
            .setTitle(user.tag)
            .setThumbnail(member?.displayAvatarURL({ dynamic: true, size: 256 } as any) ?? user.displayAvatarURL({ dynamic: true, size: 256 } as any))
            .addFields(
                { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                { name: '🤖 Bot', value: user.bot ? '✅' : '❌', inline: true },
                { name: '🏅 Badges', value: `\`${badges}\``, inline: true },
                { name: '📅 Account Created', value: createdAt, inline: true },
                { name: '📥 Joined Server', value: joinedAt, inline: true },
                { name: '📊 Join Position', value: `\`${joinPosition ? `#${joinPosition}` : 'N/A'}\``, inline: true },
                { name: `${statusEmoji[status]} Status`, value: `\`${activityLine ?? status.charAt(0).toUpperCase() + status.slice(1)}\``, inline: true },
                { name: '🏷️ Nickname', value: `\`${member?.nickname ?? 'None'}\``, inline: true },
                { name: '💎 Boosting', value: boostingSince ? `Since ${boostingSince}` : '`Not boosting`', inline: true },
                { name: `🎭 Roles [${(member?.roles.cache.size as number) - 1 || 0}]`, value: roles === 'None' ? '`None`' : roles, inline: true },
                { name: '🖥️ Device', value: `\`${presence?.clientStatus && Object.keys(presence.clientStatus).length ? Object.keys(presence.clientStatus).map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') : 'Offline'}\``, inline: true },
                { name: '🎤 Voice', value: member?.voice?.channel ? voiceLine : '`None`', inline: true },
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        if (fetchedUser.banner) {
            embed.setImage(fetchedUser.bannerURL({ size: 1024 }));
        }

        await interaction.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};
