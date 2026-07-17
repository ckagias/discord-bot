import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current track.'),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const player = client.lavalink.getPlayer(interaction.guild.id);

        if (!player || !player.playing) {
            return interaction.reply({ content: 'Nothing is playing right now.', flags: MessageFlags.Ephemeral });
        }

        const skipped = player.queue.current;
        if (player.queue.tracks.length === 0) {
            await player.stopPlaying(false, false);
        } else {
            await player.skip();
        }

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setDescription(`⏭️ Skipped **${skipped?.info.title ?? 'current track'}**.`);

        await interaction.reply({ embeds: [embed] });
    },
};
