import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChatInputCommandInteraction } from 'discord.js';
const { getWallet, updateBalance, formatBalance } = require('../../utils/economy');
const { buildDeck, isBlackjack, buildEmbed, buildRow, disabledRow, buildPvpEmbed, buildPvpRow } = require('../../utils/blackjack');
const BlackjackGame = require('../../models/BlackjackSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play Blackjack against the dealer and bet your coins.')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(1))
        .addUserOption(opt =>
            opt.setName('opponent')
                .setDescription('Challenge another player to Blackjack')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const bet = interaction.options.getInteger('bet');
        const opponent = interaction.options.getUser('opponent');

        if (opponent) return handlePvpChallenge(interaction, bet, opponent);
        return handleVsDealer(interaction, bet);
    },
};

async function handlePvpChallenge(interaction: ChatInputCommandInteraction, bet: number, opponent: any) {
    if (opponent.bot) return interaction.editReply({ content: 'You cannot challenge a bot.' });
    if (opponent.id === interaction.user.id) return interaction.editReply({ content: 'You cannot challenge yourself.' });

    const challengerWallet = await getWallet(interaction.user.id, interaction.guild.id);
    if (challengerWallet.balance < bet) {
        return interaction.editReply({ content: `You don't have enough coins. Your balance is **${formatBalance(challengerWallet.balance)}**.` });
    }

    const challengeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('bj_pvp_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bj_pvp_decline').setLabel('Decline').setStyle(ButtonStyle.Danger),
    );

    const challengeEmbed = new EmbedBuilder()
        .setTitle('Blackjack Challenge')
        .setDescription(`${interaction.user} has challenged you to Blackjack for **${formatBalance(bet)}** coins! Do you accept?`)
        .setColor(Math.floor(Math.random() * 0xFFFFFF))
        .setFooter({ text: 'You have 30 seconds to respond.' });

    const response = await interaction.editReply({ content: `${opponent}`, embeds: [challengeEmbed], components: [challengeRow] });

    const acceptCollector = response.createMessageComponentCollector({
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

    acceptCollector.on('collect', async (i) => {
        if (i.customId === 'bj_pvp_decline') {
            return i.update({ embeds: [new EmbedBuilder().setTitle('Challenge Declined').setDescription(`${opponent} declined the Blackjack challenge.`).setColor(0xc0392b)], components: [] });
        }

        const opponentWallet = await getWallet(opponent.id, interaction.guild.id);
        if (opponentWallet.balance < bet) {
            return i.update({ content: `${opponent} doesn't have enough coins to accept.`, embeds: [], components: [] });
        }

        const deck = buildDeck();
        const playerHand = [deck.pop(), deck.pop()];
        const opponentHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];

        const game = { playerHand, opponentHand, dealerHand, bet, opponentBet: bet };

        // Deduct both bets — if either fails, abort before creating the game record
        const challengerDebit = await updateBalance(interaction.user.id, interaction.guild.id, -bet);
        const opponentDebit = await updateBalance(opponent.id, interaction.guild.id, -bet);

        if (!challengerDebit || !opponentDebit) {
            if (challengerDebit) await updateBalance(interaction.user.id, interaction.guild.id, bet);
            if (opponentDebit) await updateBalance(opponent.id, interaction.guild.id, bet);
            return i.update({ content: 'One of the players no longer has enough coins. Challenge cancelled and bets refunded.', embeds: [], components: [] });
        }

        const challengerWallet2 = await getWallet(interaction.user.id, interaction.guild.id);
        const challengerCanDouble = challengerWallet2.balance >= bet;

        const message = await i.update({
            embeds: [buildPvpEmbed(game, { challenger: interaction.user, opponent })],
            components: [buildPvpRow(true, challengerCanDouble)],
            fetchReply: true,
        });

        // Create game record after message exists so messageId is valid
        await BlackjackGame.create({
            messageId: message.id,
            userId: interaction.user.id,
            guildId: interaction.guild.id,
            bet,
            deck,
            playerHand,
            dealerHand,
            opponentId: opponent.id,
            opponentHand,
            opponentBet: bet,
        });
    });

    acceptCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            interaction.editReply({ content: `${opponent} didn't respond in time. Challenge cancelled.`, embeds: [], components: [] });
        }
    });
}

async function handleVsDealer(interaction: ChatInputCommandInteraction, bet: number) {
    const wallet = await getWallet(interaction.user.id, interaction.guild.id);
    if (wallet.balance < bet) {
        return interaction.editReply({ content: `You don't have enough coins. Your balance is **${formatBalance(wallet.balance)}**.` });
    }

    await updateBalance(interaction.user.id, interaction.guild.id, -bet);

    const deck = buildDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    const game = { playerHand, dealerHand, bet };

    if (isBlackjack(playerHand)) {
        // If dealer also has blackjack it's a push — return the bet only, no 3:2 bonus
        const dealerAlsoBlackjack = isBlackjack(dealerHand);
        const payout = dealerAlsoBlackjack ? bet : bet + Math.floor(bet * 1.5);
        await updateBalance(interaction.user.id, interaction.guild.id, payout);

        const message = await interaction.editReply({
            embeds: [buildEmbed(game, { outcome: dealerAlsoBlackjack ? 'push' : 'blackjack', dealerFull: true })],
            components: [disabledRow()],
        });

        await BlackjackGame.create({
            messageId: message.id,
            userId: interaction.user.id,
            guildId: interaction.guild.id,
            bet, deck, playerHand, dealerHand,
            finished: true,
        });
        return;
    }

    const wallet2 = await getWallet(interaction.user.id, interaction.guild.id);
    const canDouble = wallet2.balance >= bet;

    const message = await interaction.editReply({
        embeds: [buildEmbed(game)],
        components: [buildRow(canDouble)],
    });

    await BlackjackGame.create({
        messageId: message.id,
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        bet, deck, playerHand, dealerHand,
    });
}
