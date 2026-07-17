import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
const axios = require('axios');
const WordleGame = require('../../models/WordleSchema');
const { updateBalance, formatBalance } = require('../../utils/economy');

// Win payouts by guess count (1 = fastest, 6 = last guess)
const WIN_REWARDS = [500, 400, 300, 200, 150, 100];
const LOSS_REWARD = 25;

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

const TILE: Record<string, string> = {
    correct: '🟩',
    present: '🟨',
    absent:  '⬛',
};


function markExactMatches(result: string[], guessChars: (string | null)[], solutionChars: (string | null)[]) {
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guessChars[i] === solutionChars[i]) {
            result[i] = 'correct';
            solutionChars[i] = null;
            guessChars[i] = null;
        }
    }
}

function markPresentLetters(result: string[], guessChars: (string | null)[], solutionChars: (string | null)[]) {
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guessChars[i] === null) continue;
        const idx = solutionChars.indexOf(guessChars[i]);
        if (idx !== -1) {
            result[i] = 'present';
            solutionChars[idx] = null;
        }
    }
}

function scoreGuess(guess: string, solution: string) {
    const result = Array(WORD_LENGTH).fill('absent');
    const solutionChars: (string | null)[] = solution.split('');
    const guessChars: (string | null)[] = guess.split('');

    markExactMatches(result, guessChars, solutionChars);
    markPresentLetters(result, guessChars, solutionChars);

    return result;
}

function renderBoard(guesses: string[], solution: string) {
    const rows = [];

    for (let g = 0; g < MAX_GUESSES; g++) {
        if (g < guesses.length) {
            const guess = guesses[g];
            const result = scoreGuess(guess, solution);
            const tiles = result.map((r) => TILE[r]).join('');
            const letters = guesses[g].toUpperCase().split('').join(' ');
            rows.push(`${tiles}  \`${letters}\``);
        } else {
            rows.push('⬜⬜⬜⬜⬜');
        }
    }

    return rows.join('\n');
}


function todayDateString() {
    return new Date().toISOString().slice(0, 10);
}

// Cache today's solution in-process so every guess/status call doesn't re-hit the NYT API.
let cachedWord: { date: string | null; solution: string | null } = { date: null, solution: null };

async function fetchTodaysWord() {
    const date = todayDateString();
    if (cachedWord.date === date) return cachedWord.solution;

    const res = await axios.get(`https://www.nytimes.com/svc/wordle/v2/${date}.json`, { timeout: 5000 });
    const solution = res.data.solution.toLowerCase();
    cachedWord = { date, solution };
    return solution;
}

function buildEmbed(game: any, solution: string, { reward = null }: { reward?: number | null } = {}) {
    const board = renderBoard(game.guesses, solution);
    const guessCount = game.guesses.length;

    let color, title, footer;

    if (game.won) {
        const praise = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
        title = praise[guessCount - 1] ?? 'You got it!';
        color = 0x538d4e;
        footer = `Solved in ${guessCount}/${MAX_GUESSES}` + (reward !== null ? ` • +${formatBalance(reward)} coins` : '');
    } else if (game.finished) {
        title = 'Better luck tomorrow!';
        color = 0x3a3a3c;
        footer = `The word was ${solution.toUpperCase()}` + (reward !== null ? ` • +${formatBalance(reward)} coins` : '');
    } else {
        title = `Wordle — Guess ${guessCount + 1}/${MAX_GUESSES}`;
        color = Math.floor(Math.random() * 0xFFFFFF);
        footer = 'Use /wordle guess <word> to make a guess';
    }

    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(board)
        .setColor(color)
        .setFooter({ text: footer });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordle')
        .setDescription("Play today's Wordle — the official NYT daily word.")
        .addSubcommand(sub =>
            sub.setName('guess')
                .setDescription('Make a 5-letter guess.')
                .addStringOption(opt =>
                    opt.setName('word')
                        .setDescription('Your 5-letter guess')
                        .setRequired(true)
                        .setMinLength(5)
                        .setMaxLength(5)))
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription("View your current board for today's Wordle.")),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const date = todayDateString();

        let solution;
        try {
            solution = await fetchTodaysWord();
        } catch {
            return interaction.editReply({ content: 'Could not fetch today\'s Wordle word. Try again in a moment.' });
        }

        const subcommand = interaction.options.getSubcommand();

        let game = await WordleGame.findOne({ userId, date });
        if (!game) {
            game = await WordleGame.create({ userId, date });
        }

        if (subcommand === 'status') {
            if (game.guesses.length === 0) {
                return interaction.editReply({ content: "You haven't made any guesses today yet! Use `/wordle guess <word>` to start." });
            }
            return interaction.editReply({ embeds: [buildEmbed(game, solution)] });
        }

        // subcommand === 'guess'
        if (game.finished) {
            const msg = game.won
                ? `You already solved today's Wordle in ${game.guesses.length}/${MAX_GUESSES}! Come back tomorrow.`
                : `Today's game is over. The word was **${solution.toUpperCase()}**. Come back tomorrow!`;
            return interaction.editReply({ content: msg });
        }

        const word = interaction.options.getString('word').toLowerCase();

        if (!/^[a-z]{5}$/.test(word)) {
            return interaction.editReply({ content: 'Your guess must be exactly 5 English letters.' });
        }

        game.guesses.push(word);

        const won = word === solution;
        const outOfGuesses = game.guesses.length >= MAX_GUESSES;

        if (won || outOfGuesses) {
            game.won = won;
            game.finished = true;
        }

        await game.save();

        let reward = null;
        if (game.finished) {
            reward = won ? (WIN_REWARDS[game.guesses.length - 1] ?? WIN_REWARDS.at(-1)) : LOSS_REWARD;
            await updateBalance(userId, interaction.guild.id, reward);
        }

        return interaction.editReply({ embeds: [buildEmbed(game, solution, { reward })] });
    },
};
