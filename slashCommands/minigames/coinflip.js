const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getWallet, updateBalance, formatBalance } = require('../../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin and optionally bet credits on it.')
        .addStringOption(option =>
            option.setName('guess')
                .setDescription('Your guess')
                .setRequired(false)
                .addChoices(
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Credits to bet (optional)')
                .setRequired(false)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply();

        const guess = interaction.options.getString('guess');
        const bet = interaction.options.getInteger('amount');
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const emoji = result === 'heads' ? '🪙' : '🟤';

        // No bet — pure flip
        if (!bet) {
            let description = `The coin landed on **${result.charAt(0).toUpperCase() + result.slice(1)}**! ${emoji}`;
            let color = Math.floor(Math.random() * 0xFFFFFF);

            if (guess) {
                const won = guess === result;
                description += won ? '\n\n✅ You guessed correctly!' : '\n\n❌ Wrong guess!';
                color = won ? 'Green' : 'Red';
            }

            const wallet = await getWallet(interaction.user.id, interaction.guild.id);
            const embed = new EmbedBuilder()
                .setTitle('Coin Flip')
                .setDescription(description)
                .setColor(color)
                .setFooter({ text: `Your balance: ${formatBalance(wallet.balance)} credits` });

            return interaction.editReply({ embeds: [embed] });
        }

        // Bet provided — require a guess
        if (!guess) {
            return interaction.editReply({ content: 'You need to pick heads or tails when betting credits.' });
        }

        const wallet = await getWallet(interaction.user.id, interaction.guild.id);
        if (wallet.balance < bet) {
            return interaction.editReply({
                content: `You don't have enough credits. Your balance is **${formatBalance(wallet.balance)}**.`,
            });
        }

        const won = guess === result;
        let newBalance;
        if (won) {
            const updated = await updateBalance(interaction.user.id, interaction.guild.id, bet);
            newBalance = updated.balance;
        } else {
            const updated = await updateBalance(interaction.user.id, interaction.guild.id, -bet);
            newBalance = updated ? updated.balance : wallet.balance - bet;
        }

        const description = `The coin landed on **${result.charAt(0).toUpperCase() + result.slice(1)}**! ${emoji}`;

        const embed = new EmbedBuilder()
            .setTitle(won ? '🎉 You Won!' : '💀 You Lost!')
            .setDescription(description)
            .addFields(
                { name: 'Result',      value: won ? `💰 +${formatBalance(bet)}` : `💸 -${formatBalance(bet)}`, inline: true },
                { name: 'New Balance', value: `💳 ${formatBalance(newBalance)} credits`,                       inline: true },
            )
            .setColor(won ? 'Green' : 'Red');

        return interaction.editReply({ embeds: [embed] });
    },
};
