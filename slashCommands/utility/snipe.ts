import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Snipe recently deleted or edited messages.')
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Show the last deleted message in this channel'))
        .addSubcommand(sub =>
            sub.setName('edit')
                .setDescription('Show the last edited message in this channel')),

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'delete') {
            const cached = interaction.client.snipeCache?.get(interaction.channelId);
            if (!cached) {
                return interaction.reply({ content: 'No recently deleted messages found in this channel.', flags: MessageFlags.Ephemeral });
            }

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setAuthor({ name: cached.author.tag, iconURL: cached.author.displayAvatarURL({ size: 64 }) })
                .setDescription(cached.content || '*No text content*')
                .setFooter({ text: 'Deleted' })
                .setTimestamp(cached.deletedAt);

            if (cached.attachmentURL) embed.setImage(cached.attachmentURL);

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'edit') {
            const cached = interaction.client.editSnipeCache?.get(interaction.channelId);
            if (!cached) {
                return interaction.reply({ content: 'No recently edited messages found in this channel.', flags: MessageFlags.Ephemeral });
            }

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setAuthor({ name: cached.author.tag, iconURL: cached.author.displayAvatarURL({ size: 64 }) })
                .addFields(
                    { name: 'Before', value: cached.before },
                    { name: 'After', value: cached.after || '*Empty*' }
                )
                .setFooter({ text: 'Edited' })
                .setTimestamp(cached.editedAt);

            return interaction.reply({ embeds: [embed] });
        }
    },
};
