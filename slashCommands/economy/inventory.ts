import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';
const InventorySchema = require('../../models/InventorySchema');

const PAGE_SIZE = 5;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your owned shop items.'),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const inv = await InventorySchema.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
        const items = inv?.items ?? [];

        if (!items.length) {
            return interaction.editReply({ content: 'Your inventory is empty. Buy items from the `/shop`.' });
        }

        const totalPages = Math.ceil(items.length / PAGE_SIZE);

        function buildEmbed(page: number) {
            const slice = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
            const lines = slice.map((item, idx) => {
                const typeTag = item.type === 'badge' ? `${item.emoji} Badge` : '🎭 Role';
                const acquired = `<t:${Math.floor(new Date(item.acquiredAt).getTime() / 1000)}:D>`;
                return `**${page * PAGE_SIZE + idx + 1}. ${item.name}** (${typeTag})\n> Acquired: ${acquired}`;
            });

            return new EmbedBuilder()
                .setTitle(`${interaction.user.username}'s Inventory`)
                .setDescription(lines.join('\n\n'))
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setFooter({ text: `Page ${page + 1} of ${totalPages} • ${items.length} item(s)` });
        }

        function buildRow(page: number) {
            return new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`inv_prev_${interaction.user.id}_${page}`)
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`inv_next_${interaction.user.id}_${page}`)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages - 1),
            );
        }

        let page = 0;
        const message = await interaction.editReply({
            embeds: [buildEmbed(page)],
            components: totalPages > 1 ? [buildRow(page)] : [],
        });

        if (totalPages <= 1) return;

        const collector = message.createMessageComponentCollector({ time: 120_000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'This is not your inventory.', ephemeral: true });
            }

            if (i.customId.startsWith('inv_prev_')) page = Math.max(0, page - 1);
            if (i.customId.startsWith('inv_next_')) page = Math.min(totalPages - 1, page + 1);

            await i.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {});
        });
    },
};
