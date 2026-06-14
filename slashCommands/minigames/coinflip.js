const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin.')
        .addStringOption(option =>
            option.setName('guess')
                .setDescription('Your guess')
                .setRequired(false)
                .addChoices(
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' }
                )),

    async execute(interaction) {
        const guess = interaction.options.getString('guess');
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const emoji = result === 'heads' ? '🪙' : '🟤';

        let description = `The coin landed on **${result.charAt(0).toUpperCase() + result.slice(1)}**! ${emoji}`;
        let color = 'Blurple';

        if (guess) {
            const won = guess === result;
            description += won ? '\n\n✅ You guessed correctly!' : '\n\n❌ Wrong guess!';
            color = won ? 'Green' : 'Red';
        }

        const embed = new EmbedBuilder()
            .setTitle('Coin Flip')
            .setDescription(description)
            .setColor(color);

        return interaction.reply({ embeds: [embed] });
    },
};
