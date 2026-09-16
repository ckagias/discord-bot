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

        const userIds = top.map(entry => entry.userId);
        const members = await interaction.guild.members.fetch({ user: userIds } as any).catch(() => null);

        const rows = top.map((entry, i) => {
            const member = (members as any)?.get(entry.userId);
            const name = member ? member.user.username : `Unknown (${entry.userId})`;
            const prefix = medals[i] ?? `**#${i + 1}**`;
            return `${prefix} ${name} — 💰 ${formatBalance(entry.balance)}`;
        });

        const embed = new EmbedBuilder()
            .setTitle(`💰 ${interaction.guild.name} — Richest Members`)
            .setColor(0xF1C40F)
            .setDescription(rows.join('\n'));

        return interaction.editReply({ embeds: [embed] });
    },
};
