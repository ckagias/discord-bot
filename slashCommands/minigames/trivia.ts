import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChatInputCommandInteraction } from 'discord.js';
const axios = require('axios');
const { updateBalance, formatBalance } = require('../../utils/economy');

const REWARDS: Record<string, number> = { easy: 50, medium: 100, hard: 200 };
const TIMEOUT_MS = 20_000;


function decode(str: string) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&ldquo;/g, '“')
        .replace(/&rdquo;/g, '”')
        .replace(/&lsquo;/g, '‘')
        .replace(/&rsquo;/g, '’');
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const LABELS = ['A', 'B', 'C', 'D'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Answer a trivia question and earn coins.')
        .addStringOption(opt =>
            opt.setName('difficulty')
                .setDescription('Question difficulty (default: random)')
                .setRequired(false)
                .addChoices(
                    { name: 'Easy (50 coins)', value: 'easy' },
                    { name: 'Medium (100 coins)', value: 'medium' },
                    { name: 'Hard (200 coins)', value: 'hard' },
                )),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const difficulty = interaction.options.getString('difficulty') ?? 'random';
        const apiUrl = difficulty === 'random'
            ? 'https://opentdb.com/api.php?amount=1&type=multiple'
            : `https://opentdb.com/api.php?amount=1&type=multiple&difficulty=${difficulty}`;

        let data;
        try {
            const res = await axios.get(apiUrl, { timeout: 5000 });
            if (res.data.response_code !== 0 || !res.data.results?.length) throw new Error();
            data = res.data.results[0];
        } catch {
            return interaction.editReply({ content: 'Could not fetch a trivia question. Try again in a moment.' });
        }

        const question = decode(data.question);
        const correct = decode(data.correct_answer);
        const diff = data.difficulty;
        const reward = REWARDS[diff] ?? 100;
        const category = decode(data.category);

        const answers = shuffle([correct, ...data.incorrect_answers.map(decode)]);
        const correctIndex = answers.indexOf(correct);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            answers.map((ans, i) =>
                new ButtonBuilder()
                    .setCustomId(`trivia_${i}`)
                    .setLabel(`${LABELS[i]}. ${ans}`)
                    .setStyle(ButtonStyle.Secondary)
            )
        );

        const embed = new EmbedBuilder()
            .setTitle('Trivia')
            .setDescription(`**${question}**`)
            .addFields(
                { name: 'Category', value: category, inline: true },
                { name: 'Difficulty', value: diff.charAt(0).toUpperCase() + diff.slice(1), inline: true },
                { name: 'Reward', value: `${formatBalance(reward)} coins`, inline: true },
            )
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setFooter({ text: `You have ${TIMEOUT_MS / 1000} seconds to answer` });

        const response = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: TIMEOUT_MS,
            filter: async (i) => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'This is not your trivia question!', ephemeral: true });
                    return false;
                }
                return true;
            },
            max: 1,
        });

        collector.on('collect', async (i) => {
            const chosen = parseInt(i.customId.split('_')[1]);
            const isCorrect = chosen === correctIndex;

            const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                answers.map((ans, idx) => {
                    let style = ButtonStyle.Secondary;
                    if (idx === correctIndex) style = ButtonStyle.Success;
                    else if (idx === chosen && !isCorrect) style = ButtonStyle.Danger;
                    return new ButtonBuilder()
                        .setCustomId(`trivia_result_${idx}`)
                        .setLabel(`${LABELS[idx]}. ${ans}`)
                        .setStyle(style)
                        .setDisabled(true);
                })
            );

            let resultText, newBalance;
            if (isCorrect) {
                const updated = await updateBalance(interaction.user.id, interaction.guild.id, reward);
                newBalance = updated?.balance;
                resultText = `✅ Correct! **+${formatBalance(reward)} coins**` + (newBalance != null ? ` → 💳 ${formatBalance(newBalance)}` : '');
            } else {
                resultText = `❌ Wrong! The correct answer was **${correct}**.`;
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle(isCorrect ? 'Correct!' : 'Wrong!')
                .setDescription(`**${question}**\n\n${resultText}`)
                .addFields(
                    { name: 'Category', value: category, inline: true },
                    { name: 'Difficulty', value: diff.charAt(0).toUpperCase() + diff.slice(1), inline: true },
                )
                .setColor(isCorrect ? 0x538d4e : 0xc0392b);

            await i.update({ embeds: [resultEmbed], components: [updatedRow] });
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const timedOutRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    answers.map((ans, idx) =>
                        new ButtonBuilder()
                            .setCustomId(`trivia_timeout_${idx}`)
                            .setLabel(`${LABELS[idx]}. ${ans}`)
                            .setStyle(idx === correctIndex ? ButtonStyle.Success : ButtonStyle.Secondary)
                            .setDisabled(true)
                    )
                );

                interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Time\'s up!')
                            .setDescription(`**${question}**\n\n⏰ You ran out of time. The correct answer was **${correct}**.`)
                            .addFields(
                                { name: 'Category', value: category, inline: true },
                                { name: 'Difficulty', value: diff.charAt(0).toUpperCase() + diff.slice(1), inline: true },
                            )
                            .setColor(0x3a3a3c),
                    ],
                    components: [timedOutRow],
                });
            }
        });
    },
};
