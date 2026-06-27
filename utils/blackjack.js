const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatBalance } = require('./economy');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function buildDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push(`${rank}${suit}`);
        }
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function cardValue(card) {
    const rank = card.slice(0, -1); // strip suit
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    if (rank === 'A') return 11;
    return parseInt(rank);
}

function handValue(hand) {
    let total = 0;
    let aces = 0;
    for (const card of hand) {
        total += cardValue(card);
        if (card.startsWith('A')) aces++;
    }
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}

function isBlackjack(hand) {
    return hand.length === 2 && handValue(hand) === 21;
}

function formatHand(hand, hideSecond = false) {
    if (hideSecond) return `${hand[0]}  🂠`;
    return hand.join('  ');
}

function buildEmbed(game, { outcome = null, dealerFull = false } = {}) {
    const { playerHand, dealerHand, bet } = game;
    const playerTotal = handValue(playerHand);
    const dealerTotal = dealerFull ? handValue(dealerHand) : cardValue(dealerHand[0]);

    let title, color, footer;

    if (outcome === 'blackjack') {
        title = '🃏 Blackjack! You win!';
        color = 0x538d4e;
        footer = `+${formatBalance(Math.floor(bet * 1.5))} coins (3:2 payout)`;
    } else if (outcome === 'win') {
        title = '🎉 You win!';
        color = 0x538d4e;
        footer = `+${formatBalance(bet)} coins`;
    } else if (outcome === 'bust') {
        title = '💥 Bust! You lose.';
        color = 0xc0392b;
        footer = `-${formatBalance(bet)} coins`;
    } else if (outcome === 'lose') {
        title = '💀 Dealer wins.';
        color = 0xc0392b;
        footer = `-${formatBalance(bet)} coins`;
    } else if (outcome === 'push') {
        title = '🤝 Push — it\'s a tie!';
        color = 0xe3a015;
        footer = 'Bet returned';
    } else {
        title = 'Blackjack';
        color = Math.floor(Math.random() * 0xFFFFFF);
        footer = `Bet: ${formatBalance(bet)} coins`;
    }

    return new EmbedBuilder()
        .setTitle(title)
        .addFields(
            {
                name: `Your Hand (${playerTotal})`,
                value: formatHand(playerHand),
                inline: false,
            },
            {
                name: `Dealer's Hand (${dealerFull ? dealerTotal : '?'})`,
                value: formatHand(dealerHand, !dealerFull),
                inline: false,
            },
        )
        .setColor(color)
        .setFooter({ text: footer });
}

function buildRow(canDouble) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Success).setDisabled(!canDouble),
    );
}

function disabledRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Success).setDisabled(true),
    );
}

// Dealer draws until 17+
function dealerPlay(hand, deck) {
    while (handValue(hand) < 17) {
        hand.push(deck.pop());
    }
}

// PvP embed — shows both players' hands and the dealer
function buildPvpEmbed(game, { challenger, opponent, outcome = null } = {}) {
    const { playerHand, opponentHand, dealerHand, bet, opponentBet } = game;
    const dealerFull = outcome !== null;
    const playerTotal = handValue(playerHand);
    const opponentTotal = handValue(opponentHand);
    const dealerTotal = dealerFull ? handValue(dealerHand) : null;

    let title, color;
    if (outcome) {
        title = 'Blackjack — Results';
        color = 0xe3a015;
    } else {
        title = 'Blackjack — PvP';
        color = Math.floor(Math.random() * 0xFFFFFF);
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .addFields(
            {
                name: `${challenger?.username ?? 'Challenger'}'s Hand (${playerTotal})`,
                value: formatHand(playerHand),
                inline: false,
            },
            {
                name: `${opponent?.username ?? 'Opponent'}'s Hand (${opponentTotal})`,
                value: opponentHand.length ? formatHand(opponentHand) : '🂠  🂠',
                inline: false,
            },
            {
                name: `Dealer's Hand (${dealerFull ? dealerTotal : '?'})`,
                value: formatHand(dealerHand, !dealerFull),
                inline: false,
            },
        );

    if (outcome) {
        embed.setFooter({ text: outcome });
    } else {
        embed.setFooter({ text: `Bet: ${formatBalance(bet)} vs ${formatBalance(opponentBet)} coins` });
    }

    return embed;
}

function buildPvpRow(isChallenger, canDouble) {
    const prefix = isChallenger ? 'bj' : 'bjop';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${prefix}_hit`).setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`${prefix}_stand`).setLabel('Stand').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${prefix}_double`).setLabel('Double Down').setStyle(ButtonStyle.Success).setDisabled(!canDouble),
    );
}

module.exports = { buildDeck, handValue, isBlackjack, buildEmbed, buildRow, disabledRow, dealerPlay, buildPvpEmbed, buildPvpRow };
