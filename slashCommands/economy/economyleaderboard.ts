import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
const EconomySchema = require('../../models/EconomySchema');
const { formatBalance } = require('../../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economyleaderboard')
        .setDescription('Show the richest members in this server.'),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const top = await EconomySchema.find({ guildId: interaction.guild.id })
            .sort({ balance: -1 })
            .limit(10);

        if (!top.length) {
            return interaction.editReply({ content: 'No one has any credits yet. Use `/daily` to get started!' });
        }

        const medals = ['🥇', '🥈', '🥉'];

        const rows = await Promise.all(
            top.map(async (entry, i) => {
                const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
                const name = user ? user.username : `Unknown (${entry.userId})`;
                const prefix = medals[i] ?? `**#${i + 1}**`;
                return `${prefix} ${name} — 💰 ${formatBalance(entry.balance)}`;
            })
        );

        const embed = new EmbedBuilder()
            .setTitle(`💰 ${interaction.guild.name} — Richest Members`)
            .setColor(0xF1C40F)
            .setDescription(rows.join('\n'));

        return interaction.editReply({ embeds: [embed] });
    },
};
