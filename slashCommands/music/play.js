const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration } = require('../../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or playlist from YouTube, SoundCloud, and more.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Song name or URL')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        await interaction.deferReply();

        const member = interaction.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return interaction.editReply({ content: '❌ You need to be in a voice channel first.' });
        }

        const botMember = interaction.guild.members.me;
        if (botMember.voice.channel && botMember.voice.channel.id !== voiceChannel.id) {
            return interaction.editReply({ content: '❌ I\'m already playing in a different voice channel.' });
        }

        const query = interaction.options.getString('query');

        try {
            let player = client.lavalink.getPlayer(interaction.guild.id);
            if (!player) {
                player = client.lavalink.createPlayer({
                    guildId: interaction.guild.id,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: interaction.channel.id,
                    selfDeaf: true,
                    selfMute: false,
                });
            }

            if (!player.connected) await player.connect();

            const result = await player.search(
                { query, source: 'ytsearch' },
                interaction.user
            );

            if (!result || result.loadType === 'empty' || result.loadType === 'error') {
                return interaction.editReply({ content: '❌ No results found for that query.' });
            }

            if (result.loadType === 'playlist') {
                for (const track of result.tracks) player.queue.add(track);

                const embed = new EmbedBuilder()
                    .setColor(Math.floor(Math.random() * 0xFFFFFF))
                    .setTitle('📋 Playlist Queued')
                    .setDescription(`**${result.playlist.name}**`)
                    .addFields({ name: 'Tracks', value: `${result.tracks.length}`, inline: true })
                    .setFooter({ text: `Requested by ${interaction.user.tag}` });

                await interaction.editReply({ embeds: [embed] });
            } else {
                const track = result.tracks[0];
                player.queue.add(track);

                const embed = new EmbedBuilder()
                    .setColor(Math.floor(Math.random() * 0xFFFFFF))
                    .setAuthor(player.playing ? { name: '📋 Added to Queue' } : { name: 'Now Playing', iconURL: client.user.displayAvatarURL({ size: 32 }) })
                    .setDescription(`**[${track.info.title}](${track.info.uri})**`)
                    .addFields(
                        { name: 'Author', value: track.info.author, inline: true },
                        { name: 'Duration', value: track.info.isStream ? 'LIVE' : formatDuration(track.info.duration), inline: true }
                    )
                    .setThumbnail(track.info.artworkUrl ?? null)

                await interaction.editReply({ embeds: [embed] });
            }

            if (!player.playing) await player.play();
        } catch (error) {
            console.error('[play] Lavalink error:', error);
            const payload = { content: '❌ Music service is unavailable. Please try again later.' };
            await interaction.editReply(payload).catch(() => {});
        }
    },
};
