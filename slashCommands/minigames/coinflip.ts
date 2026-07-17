import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChatInputCommandInteraction } from 'discord.js';
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
                .setMinValue(1))
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('Challenge another player to a coinflip')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const guess = interaction.options.getString('guess');
        const bet = interaction.options.getInteger('amount');
        const opponent = interaction.options.getUser('opponent');

        // PvP mode
        if (opponent) {
            if (opponent.bot) return interaction.editReply({ content: 'You cannot challenge a bot.' });
            if (opponent.id === interaction.user.id) return interaction.editReply({ content: 'You cannot challenge yourself.' });
            if (!bet) return interaction.editReply({ content: 'You must set a bet when challenging another player.' });

            const challengerWallet = await getWallet(interaction.user.id, interaction.guild.id);
            if (challengerWallet.balance < bet) {
                return interaction.editReply({ content: `You don't have enough credits. Your balance is **${formatBalance(challengerWallet.balance)}**.` });
            }

            const challengeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('cf_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('cf_decline').setLabel('Decline').setStyle(ButtonStyle.Danger),
            );

            const challengeEmbed = new EmbedBuilder()
                .setTitle('Coinflip Challenge')
                .setDescription(`${interaction.user} has challenged you to a coinflip for **${formatBalance(bet)}** credits! Do you accept?`)
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setFooter({ text: 'You have 30 seconds to respond.' });

            const response = await interaction.editReply({ content: `${opponent}`, embeds: [challengeEmbed], components: [challengeRow] });

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 30_000,
                max: 1,
                filter: async (i) => {
                    if (i.user.id !== opponent.id) {
                        await i.reply({ content: 'This challenge is not for you!', ephemeral: true });
                        return false;
                    }
                    return true;
                },
            });

            collector.on('collect', async (i) => {
                if (i.customId === 'cf_decline') {
                    return i.update({ embeds: [new EmbedBuilder().setTitle('Challenge Declined').setDescription(`${opponent} declined the coinflip.`).setColor(0xc0392b)], components: [] });
                }

                const opponentWallet = await getWallet(opponent.id, interaction.guild.id);
                if (opponentWallet.balance < bet) {
                    return i.update({ content: `${opponent} doesn't have enough credits to accept.`, embeds: [], components: [] });
                }

                const result = Math.random() < 0.5 ? 'heads' : 'tails';
                const emoji = result === 'heads' ? '🪙' : '🟤';
                // Challenger picks their guess (from the optional guess option), random if not provided
                const challengerGuess = guess ?? (Math.random() < 0.5 ? 'heads' : 'tails');
                const challengerWon = challengerGuess === result;

                // Deduct both bets up front, then credit the winner — prevents one side paying if the other spent coins after accepting
                const challengerDebit = await updateBalance(interaction.user.id, interaction.guild.id, -bet);
                const opponentDebit = await updateBalance(opponent.id, interaction.guild.id, -bet);

                if (!challengerDebit || !opponentDebit) {
                    if (challengerDebit) await updateBalance(interaction.user.id, interaction.guild.id, bet);
                    if (opponentDebit) await updateBalance(opponent.id, interaction.guild.id, bet);
                    return i.update({ content: 'One of the players no longer has enough credits. Game cancelled and bets refunded.', embeds: [], components: [] });
                }

                await updateBalance(challengerWon ? interaction.user.id : opponent.id, interaction.guild.id, bet * 2);

                const guessLabel = challengerGuess.charAt(0).toUpperCase() + challengerGuess.slice(1);
                const resultEmbed = new EmbedBuilder()
                    .setTitle(`${challengerWon ? interaction.user.username : opponent.username} wins!`)
                    .setDescription(`The coin landed on **${result.charAt(0).toUpperCase() + result.slice(1)}**! ${emoji}\n\n${interaction.user} called **${guessLabel}** — ${challengerWon ? '✅ correct!' : '❌ wrong!'}`)
                    .addFields(
                        { name: interaction.user.username, value: challengerWon ? `💰 +${formatBalance(bet)}` : `💸 -${formatBalance(bet)}`, inline: true },
                        { name: opponent.username, value: challengerWon ? `💸 -${formatBalance(bet)}` : `💰 +${formatBalance(bet)}`, inline: true },
                    )
                    .setColor(challengerWon ? 0x538d4e : 0xc0392b);

                await i.update({ embeds: [resultEmbed], components: [] });
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    interaction.editReply({ content: `${opponent} didn't respond in time. Challenge cancelled.`, embeds: [], components: [] });
                }
            });

            return;
        }

        // vs bot mode (original)
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const emoji = result === 'heads' ? '🪙' : '🟤';

        if (!bet) {
            let description = `The coin landed on **${result.charAt(0).toUpperCase() + result.slice(1)}**! ${emoji}`;
            let color = Math.floor(Math.random() * 0xFFFFFF);

            if (guess) {
                const won = guess === result;
                description += won ? '\n\n✅ You guessed correctly!' : '\n\n❌ Wrong guess!';
                color = won ? 0x538d4e : 0xc0392b;
            }

            const wallet = await getWallet(interaction.user.id, interaction.guild.id);
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Coin Flip')
                        .setDescription(description)
                        .setColor(color)
                        .setFooter({ text: `Your balance: ${formatBalance(wallet.balance)} credits` }),
                ],
            });
        }

        if (!guess) return interaction.editReply({ content: 'You need to pick heads or tails when betting credits.' });

        const wallet = await getWallet(interaction.user.id, interaction.guild.id);
        if (wallet.balance < bet) {
            return interaction.editReply({ content: `You don't have enough credits. Your balance is **${formatBalance(wallet.balance)}**.` });
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

        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(won ? '🎉 You Won!' : '💀 You Lost!')
                    .setDescription(`The coin landed on **${result.charAt(0).toUpperCase() + result.slice(1)}**! ${emoji}`)
                    .addFields(
                        { name: 'Result',      value: won ? `💰 +${formatBalance(bet)}` : `💸 -${formatBalance(bet)}`, inline: true },
                        { name: 'New Balance', value: `💳 ${formatBalance(newBalance)} credits`,                       inline: true },
                    )
                    .setColor(won ? 0x538d4e : 0xc0392b),
            ],
        });
    },
};
