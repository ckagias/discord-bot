import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { formatBalance } from './economy';

const MAX_WRONG = 6;

const WORDS = [
    'apple','brave','crane','drive','elbow','flame','grace','house','image','judge',
    'knife','lemon','magic','noble','ocean','piano','queen','river','stone','tiger',
    'ultra','vivid','watch','xenon','yacht','zebra','blaze','cloud','dance','eagle',
    'feast','giant','heart','irony','jewel','knack','lunar','maple','nerve','olive',
    'plumb','quest','radar','saint','table','uncle','visor','witch','xerox','yield',
    'abbey','birth','camel','devil','ember','ferry','globe','haste','inlet','joker',
    'karma','lance','medal','night','orbit','prism','quart','raven','shelf','tower',
    'ulcer','vapor','weave','xylem','zonal','album','bison','cobra','dwarf','epoch',
    'flank','glove','hound','igloo','joust','kudos','lyric','manor','nymph','optic',
    'plank','quota','rhyme','swamp','trout','umbra','venom','waltz','pixel','sword',
];

function pickWord(): string {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
}

const STAGES = [
    // 0 wrong
    '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
    // 1 wrong
    '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
    // 2 wrong
    '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
    // 3 wrong
    '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
    // 4 wrong
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
    // 5 wrong
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
    // 6 wrong (dead)
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```',
];

const REWARD = 150;

function renderWord(word: string, guessed: string[]): string {
    return word.split('').map(l => (guessed.includes(l) ? `**${l.toUpperCase()}**` : '\\_')).join(' ');
}

interface HangmanGame {
    word: string;
    guessed: string[];
    wrong: number;
    won: boolean;
    finished: boolean;
}

function buildEmbed(game: HangmanGame, { reward = null }: { reward?: number | null } = {}): EmbedBuilder {
    const { word, guessed, wrong, won, finished } = game;
    const wrongLetters = guessed.filter(l => !word.includes(l));
    const wordDisplay = renderWord(word, guessed);

    let title: string, color: number;
    if (won) {
        title = 'You saved him! 🎉';
        color = 0x538d4e;
    } else if (finished) {
        title = 'He didn\'t make it. 💀';
        color = 0xc0392b;
    } else {
        title = `Hangman — ${MAX_WRONG - wrong} lives left`;
        color = Math.floor(Math.random() * 0xFFFFFF);
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${STAGES[wrong]}\n${wordDisplay}`)
        .setColor(color);

    if (wrongLetters.length > 0) {
        embed.addFields({ name: 'Wrong guesses', value: wrongLetters.map(l => l.toUpperCase()).join('  '), inline: false });
    }

    if (finished) {
        const rewardLine = reward !== null ? ` • +${formatBalance(reward)} coins` : '';
        embed.setFooter({ text: won ? `Solved!${rewardLine}` : `The word was: ${word.toUpperCase()}` });
    } else {
        embed.setFooter({ text: 'Press "Guess a Letter" to play' });
    }

    return embed;
}

function buildRow(finished: boolean): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('hangman_guess')
            .setLabel('Guess a Letter')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(finished),
        new ButtonBuilder()
            .setCustomId('hangman_quit')
            .setLabel('Give Up')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(finished),
    );
}

export { pickWord, buildEmbed, buildRow, MAX_WRONG, REWARD };
