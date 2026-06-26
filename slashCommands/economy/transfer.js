const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { updateBalance, getWallet, formatBalance } = require('../../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Transfer credits to another member.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to transfer credits to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of credits to transfer')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (target.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot transfer credits to yourself.', flags: MessageFlags.Ephemeral });
        }

        if (target.bot) {
            return interaction.reply({ content: 'You cannot transfer credits to a bot.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();

        const senderWallet = await updateBalance(interaction.user.id, interaction.guild.id, -amount);

        if (!senderWallet) {
            const current = await getWallet(interaction.user.id, interaction.guild.id);
            return interaction.editReply({
                content: `You don't have enough credits. Your balance is **${formatBalance(current.balance)}**.`,
            });
        }

        await updateBalance(target.id, interaction.guild.id, amount);

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setTitle('Transfer Complete')
            .addFields(
                { name: 'To',          value: `${target}`,                                    inline: true },
                { name: 'Amount',      value: `💰 **${formatBalance(amount)}** credits`,      inline: true },
                { name: 'Your Balance', value: `💳 **${formatBalance(senderWallet.balance)}** credits`, inline: true },
            );

        return interaction.editReply({ embeds: [embed] });
    },
};
