import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
const { formatDuration } = require('../../utils/music');
const log = require('../../utils/log');
const logger = log.scope('nowplaying');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show details about the currently playing track.'),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player || !player.queue.current) {
            return interaction.reply({ content: '❌ Nothing is playing right now.', flags: MessageFlags.Ephemeral });
        }

        try {
            const track = player.queue.current;
            const position = player.position;
            const duration = track.info.duration;

            const progressBar = track.info.isStream ? '🔴 LIVE' : buildProgressBar(position, duration);

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setAuthor({ name: 'Now Playing', iconURL: client.user.displayAvatarURL({ size: 32 }) })
                .setDescription(`**[${track.info.title}](${track.info.uri})**`)
                .addFields(
                    { name: 'Author', value: track.info.author, inline: true },
                    { name: 'Duration', value: track.info.isStream ? 'LIVE' : `${formatDuration(position)} / ${formatDuration(duration)}`, inline: true },
                    { name: 'Requested By', value: `${track.requester}`, inline: true },
                    { name: 'Progress', value: progressBar },
                )
                .setThumbnail(track.info.artworkUrl ?? null)

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('Lavalink error:', error);
            await interaction.reply({ content: '❌ Failed to fetch track info. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};

function buildProgressBar(position: number, duration: number) {
    const BAR_LENGTH = 20;
    const filled = Math.round((position / duration) * BAR_LENGTH);
    const empty = BAR_LENGTH - filled;
    return `\`[${'▬'.repeat(filled)}🔘${'─'.repeat(Math.max(0, empty - 1))}]\``;
};
