const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration } = require('../../utils/music');

const PAGE_SIZE = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current queue.')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number')
                .setMinValue(1)
        ),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player || !player.queue.current) {
            return interaction.reply({ content: '❌ Nothing is playing right now.' });
        }

        try {
            const queue = player.queue.tracks;
            const page = (interaction.options.getInteger('page') ?? 1) - 1;
            const totalPages = Math.max(1, Math.ceil(queue.length / PAGE_SIZE));

            if (page >= totalPages) {
                return interaction.reply({ content: `❌ Page ${page + 1} doesn't exist. Max page is ${totalPages}.` });
            }

            const current = player.queue.current;
            const slice = queue.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

            const currentDuration = current.info.isStream ? 'LIVE' : formatDuration(current.info.duration);
            const nowPlaying = `[${current.info.title}] — ${current.info.author} · [${currentDuration}]`;

            const upNext = slice.length > 0
                ? slice.map((t, i) => {
                    const dur = t.info.isStream ? 'LIVE' : formatDuration(t.info.duration);
                    return `**${page * PAGE_SIZE + i + 1}.** [${t.info.title}](${t.info.uri})\n-# ${t.info.author} • ${dur}`;
                }).join('\n')
                : '*No more tracks in queue.*';

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setAuthor({ name: 'Queue', iconURL: client.user.displayAvatarURL({ size: 32 }) })
                .setDescription(`**Now Playing:**\n${nowPlaying}\n\n**Up Next:**\n${upNext}`)
                .setThumbnail(current.info.artworkUrl ?? null)
                .setFooter({ text: `Page ${page + 1}/${totalPages} · ${queue.length} track(s) in queue` });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[queue] Lavalink error:', error);
            await interaction.reply({ content: '❌ Failed to fetch queue. Please try again.' }).catch(() => {});
        }
    },
};
