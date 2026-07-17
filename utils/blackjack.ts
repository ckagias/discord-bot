import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, User } from 'discord.js';
import { formatBalance } from './economy';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function buildDeck(): string[] {
    const deck: string[] = [];
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

function cardValue(card: string): number {
    const rank = card.slice(0, -1); // strip suit
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    if (rank === 'A') return 11;
    return parseInt(rank);
}

function handValue(hand: string[]): number {
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

function isBlackjack(hand: string[]): boolean {
    return hand.length === 2 && handValue(hand) === 21;
}

function formatHand(hand: string[], hideSecond = false): string {
    if (hideSecond) return `${hand[0]}  🂠`;
    return hand.join('  ');
}

interface BlackjackGame {
    playerHand: string[];
    dealerHand: string[];
    bet: number;
}

function buildEmbed(game: BlackjackGame, { outcome = null, dealerFull = false }: { outcome?: string | null; dealerFull?: boolean } = {}): EmbedBuilder {
    const { playerHand, dealerHand, bet } = game;
    const playerTotal = handValue(playerHand);
    const dealerTotal = dealerFull ? handValue(dealerHand) : cardValue(dealerHand[0]);

    let title: string, color: number, footer: string;

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

function buildRow(canDouble: boolean): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Success).setDisabled(!canDouble),
    );
}

function disabledRow(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Success).setDisabled(true),
    );
}

function dealerPlay(hand: string[], deck: string[]): void {
    while (handValue(hand) < 17) {
        hand.push(deck.pop()!);
    }
}

interface PvpGame {
    playerHand: string[];
    opponentHand: string[];
    dealerHand: string[];
    bet: number;
    opponentBet: number;
}

function buildPvpEmbed(game: PvpGame, { challenger = undefined, opponent = undefined, outcome = null }: { challenger?: User; opponent?: User; outcome?: string | null } = {}): EmbedBuilder {
    const { playerHand, opponentHand, dealerHand, bet, opponentBet } = game;
    const dealerFull = outcome !== null;
    const playerTotal = handValue(playerHand);
    const opponentTotal = handValue(opponentHand);
    const dealerTotal = dealerFull ? handValue(dealerHand) : null;

    let title: string, color: number;
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

function buildPvpRow(isChallenger: boolean, canDouble: boolean): ActionRowBuilder<ButtonBuilder> {
    const prefix = isChallenger ? 'bj' : 'bjop';
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${prefix}_hit`).setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`${prefix}_stand`).setLabel('Stand').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${prefix}_double`).setLabel('Double Down').setStyle(ButtonStyle.Success).setDisabled(!canDouble),
    );
}

export { buildDeck, handValue, isBlackjack, buildEmbed, buildRow, disabledRow, dealerPlay, buildPvpEmbed, buildPvpRow };
