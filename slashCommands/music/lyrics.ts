import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
const axios = require('axios');
const log = require('../../utils/log');
const logger = log.scope('lyrics');

const PAGE_SIZE = 3900;
const COLLECTOR_TIME = 120_000;
const LRCLIB_HEADERS = { 'User-Agent': 'DiscordMusicBot (lrclib.net)' };

// Strip noise added by YouTube/uploaders to improve lrclib match rate
function cleanTitle(title: string) {
    return title
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\b(official|lyrics|video|audio|hd|4k|mv|music|visualizer|feat\.?.*)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

async function fetchStructuredLyrics(cleanedTitle: string, artist: string) {
    try {
        const res = await axios.get('https://lrclib.net/api/get', {
            params: { track_name: cleanedTitle, artist_name: artist },
            headers: LRCLIB_HEADERS,
            timeout: 8000,
        });
        return res.data?.plainLyrics ?? null;
    } catch (err: any) {
        if (!err.response || err.response.status !== 404) throw err;
        return null;
    }
}

async function fetchLyricsViaSearch(cleanedTitle: string, artist: string) {
    const res = await axios.get('https://lrclib.net/api/search', {
        params: { q: `${cleanedTitle} ${artist}` },
        headers: LRCLIB_HEADERS,
        timeout: 8000,
    });
    const match = (res.data ?? []).find((entry: any) => entry.plainLyrics);
    return match?.plainLyrics ?? null;
}

async function fetchLyrics(title: string, artist: string) {
    const cleanedTitle = cleanTitle(title);
    const structured = await fetchStructuredLyrics(cleanedTitle, artist);
    return structured ?? fetchLyricsViaSearch(cleanedTitle, artist);
}

function splitLyrics(lyrics: string) {
    const lines = lyrics.split('\n');
    const pages = [];
    let current = '';

    for (const line of lines) {
        const candidate = current ? `${current}\n${line}` : line;
        if (candidate.length > PAGE_SIZE) {
            if (current) pages.push(current);
            current = line;
        } else {
            current = candidate;
        }
    }
    if (current) pages.push(current);
    return pages;
}

function buildEmbed(client: Client, track: any, pages: string[], pageIndex: number, color: number) {
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: 'Lyrics', iconURL: client.user.displayAvatarURL({ size: 32 }) })
        .setTitle(track.info.title)
        .setURL(track.info.uri)
        .setThumbnail(track.info.artworkUrl ?? null)
        .setDescription(pages[pageIndex])
        .setFooter({ text: `Page ${pageIndex + 1}/${pages.length} · ${track.info.author} · via lrclib.net` });
}

function buildRow(pageIndex: number, totalPages: number) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('lyrics_prev')
            .setLabel('◀ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
        new ButtonBuilder()
            .setCustomId('lyrics_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === totalPages - 1),
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Show lyrics for the currently playing song.'),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player || !player.queue.current) {
            return interaction.reply({ content: '❌ Nothing is playing right now.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();

        try {
            const track = player.queue.current;
            const plainLyrics = await fetchLyrics(track.info.title, track.info.author);

            if (!plainLyrics) {
                return interaction.editReply({ content: `❌ Couldn't find lyrics for **${track.info.title}**.` });
            }

            const pages = splitLyrics(plainLyrics);
            const color = Math.floor(Math.random() * 0xFFFFFF);
            let pageIndex = 0;

            if (pages.length === 1) {
                return interaction.editReply({ embeds: [buildEmbed(client, track, pages, 0, color)] });
            }

            const response = await interaction.editReply({
                embeds: [buildEmbed(client, track, pages, pageIndex, color)],
                components: [buildRow(pageIndex, pages.length)],
            });

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: COLLECTOR_TIME,
                filter: i => i.user.id === interaction.user.id,
            });

            collector.on('collect', async (i) => {
                if (i.customId === 'lyrics_prev') pageIndex = Math.max(0, pageIndex - 1);
                if (i.customId === 'lyrics_next') pageIndex = Math.min(pages.length - 1, pageIndex + 1);
                await i.update({
                    embeds: [buildEmbed(client, track, pages, pageIndex, color)],
                    components: [buildRow(pageIndex, pages.length)],
                });
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => {});
            });
        } catch (error) {
            logger.error('Error fetching lyrics:', error);
            await interaction.editReply({ content: '❌ Failed to fetch lyrics. Please try again.' }).catch(() => {});
        }
    },
};
