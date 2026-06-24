const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getWallet, updateBalance, formatBalance } = require('../../utils/economy');

const choices = { rock: '🪨', paper: '📄', scissors: '✂️' };

const outcomes = {
    rock:     { rock: 'tie', paper: 'lose', scissors: 'win' },
    paper:    { rock: 'win', paper: 'tie',  scissors: 'lose' },
    scissors: { rock: 'lose', paper: 'win', scissors: 'tie' },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play Rock Paper Scissors against the bot.')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Credits to bet (optional)')
                .setRequired(false)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply();

        const bet = interaction.options.getInteger('amount');

        if (bet) {
            const wallet = await getWallet(interaction.user.id, interaction.guild.id);
            if (wallet.balance < bet) {
                return interaction.editReply({
                    content: `You don't have enough credits. Your balance is **${formatBalance(wallet.balance)}**.`,
                });
            }
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rock').setLabel('Rock').setEmoji('🪨').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('paper').setLabel('Paper').setEmoji('📄').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('scissors').setLabel('Scissors').setEmoji('✂️').setStyle(ButtonStyle.Secondary),
        );

        const response = await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Rock Paper Scissors')
                    .setDescription(bet ? `Betting **${formatBalance(bet)}** credits — choose your move!` : 'Choose your move!')
                    .setColor(Math.floor(Math.random() * 0xFFFFFF)),
            ],
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

            const fields = [
                { name: 'Your Choice', value: `${choices[userChoice]} ${userChoice.charAt(0).toUpperCase() + userChoice.slice(1)}`, inline: true },
                { name: 'Bot\'s Choice', value: `${choices[botChoice]} ${botChoice.charAt(0).toUpperCase() + botChoice.slice(1)}`, inline: true },
            ];

            if (bet) {
                let newBalance;
                if (outcome === 'win') {
                    const updated = await updateBalance(interaction.user.id, interaction.guild.id, bet);
                    newBalance = updated.balance;
                    fields.push({ name: 'Result', value: `💰 +${formatBalance(bet)} → 💳 ${formatBalance(newBalance)}`, inline: false });
                } else if (outcome === 'lose') {
                    const updated = await updateBalance(interaction.user.id, interaction.guild.id, -bet);
                    newBalance = updated ? updated.balance : 0;
                    fields.push({ name: 'Result', value: `💸 -${formatBalance(bet)} → 💳 ${formatBalance(newBalance)}`, inline: false });
                } else {
                    const wallet = await getWallet(interaction.user.id, interaction.guild.id);
                    fields.push({ name: 'Result', value: `🤝 Tie — bet returned → 💳 ${formatBalance(wallet.balance)}`, inline: false });
                }
            } else {
                const wallet = await getWallet(interaction.user.id, interaction.guild.id);
                fields.push({ name: 'Your Balance', value: `💳 ${formatBalance(wallet.balance)} credits`, inline: false });
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle(titles[outcome])
                .addFields(fields)
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
