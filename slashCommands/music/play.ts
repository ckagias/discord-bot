import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
const { formatDuration, SPOTIFY_TRACK_URL, SPOTIFY_OTHER_URL, resolveSpotifyTrackQuery } = require('../../utils/music');
const log = require('../../utils/log');
const logger = log.scope('play');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or playlist from YouTube, Spotify, SoundCloud, and more.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Song name or URL')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const member = interaction.member as any;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel first.', flags: MessageFlags.Ephemeral });
        }

        const botMember = interaction.guild.members.me;
        if (botMember.voice.channel && botMember.voice.channel.id !== voiceChannel.id) {
            return interaction.reply({ content: 'I\'m already playing in a different voice channel.', flags: MessageFlags.Ephemeral });
        }

        let query = interaction.options.getString('query');

        if (SPOTIFY_OTHER_URL.test(query)) {
            return interaction.reply({ content: 'Spotify album, playlist, and artist links aren\'t supported yet — please use a track link or a search query.', flags: MessageFlags.Ephemeral });
        }

        // Defer first: the Spotify lookup is a network call and can pass Discord's 3-second window for a first response.
        await interaction.deferReply();

        let searchedFromSpotify = false;
        if (SPOTIFY_TRACK_URL.test(query)) {
            const resolved = await resolveSpotifyTrackQuery(query).catch(() => null);
            if (!resolved) {
                return interaction.editReply({ content: 'Could not resolve that Spotify link.' });
            }
            query = resolved;
            searchedFromSpotify = true;
        }

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

            const isUrl = !searchedFromSpotify && /^https?:\/\//i.test(query);
            const result = await player.search(
                isUrl ? { query } : { query, source: 'ytsearch' },
                interaction.user
            );

            if (result?.loadType === 'error') {
                logger.error(`Loading "${query}" failed in guild "${interaction.guild.id}" (${result.exception?.severity ?? 'unknown severity'}): ${result.exception?.message ?? 'no message'}${result.exception?.cause ? ` | cause: ${result.exception.cause}` : ''}`);
                return interaction.editReply({ content: 'Could not load that track or playlist. The source may be blocking requests or the video may be unavailable. Try a different query.' });
            }

            if (!result || result.loadType === 'empty') {
                return interaction.editReply({ content: 'No results found for that query.' });
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
            logger.error('Lavalink error:', error);
            const payload = { content: 'Music service is unavailable. Please try again later.' };
            await interaction.editReply(payload).catch(() => {});
        }
    },
};
