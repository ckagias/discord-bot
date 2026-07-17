import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
const { getWallet, formatBalance } = require('../../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your or another user\'s balance.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check (defaults to you)')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('user') ?? interaction.user;
        const wallet = await getWallet(target.id, interaction.guild.id);

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setAuthor({ name: target.username, iconURL: target.displayAvatarURL({ size: 64 }) })
            .addFields({ name: 'Balance', value: `💰 **${formatBalance(wallet.balance)}** credits` })
            .setFooter({ text: interaction.guild.name });

        return interaction.editReply({ embeds: [embed] });
    },
};
