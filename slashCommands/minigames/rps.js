const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const choices = { rock: '🪨', paper: '📄', scissors: '✂️' };

const outcomes = {
    rock:     { rock: 'tie', paper: 'lose', scissors: 'win' },
    paper:    { rock: 'win', paper: 'tie',  scissors: 'lose' },
    scissors: { rock: 'lose', paper: 'win', scissors: 'tie' },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play Rock Paper Scissors against the bot.'),

    async execute(interaction) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rock').setLabel('Rock').setEmoji('🪨').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('paper').setLabel('Paper').setEmoji('📄').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('scissors').setLabel('Scissors').setEmoji('✂️').setStyle(ButtonStyle.Secondary),
        );

        const response = await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('Rock Paper Scissors').setDescription('Choose your move!').setColor(Math.floor(Math.random() * 0xFFFFFF))],
            components: [row],
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000,
            filter: i => i.user.id === interaction.user.id,
            max: 1,
        });

        collector.on('collect', async (i) => {
            const userChoice = i.customId;
            const botChoice = Object.keys(choices)[Math.floor(Math.random() * 3)];
            const outcome = outcomes[userChoice][botChoice];

            const titles = { win: '🎉 You Win!', lose: '💀 You Lose!', tie: '🤝 It\'s a Tie!' };
            const colors = { win: 'Green', lose: 'Red', tie: 'Yellow' };

            const resultEmbed = new EmbedBuilder()
                .setTitle(titles[outcome])
                .addFields(
                    { name: 'Your Choice', value: `${choices[userChoice]} ${userChoice.charAt(0).toUpperCase() + userChoice.slice(1)}`, inline: true },
                    { name: 'Bot\'s Choice', value: `${choices[botChoice]} ${botChoice.charAt(0).toUpperCase() + botChoice.slice(1)}`, inline: true },
                )
                .setColor(colors[outcome]);

            await i.update({ embeds: [resultEmbed], components: [] });
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                interaction.editReply({ content: '⏰ Time is up! Game cancelled.', embeds: [], components: [] });
            }
        });
    },
};
