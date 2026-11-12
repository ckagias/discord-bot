import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChatInputCommandInteraction } from 'discord.js';
const { getWallet, updateBalance, formatBalance } = require('../../utils/economy');
const { resolveGamble } = require('../../utils/gamble');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Bet your credits on a high-low roll!')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of credits to bet')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const bet = interaction.options.getInteger('amount');
        const wallet = await getWallet(interaction.user.id, interaction.guild.id);

        if (wallet.balance < bet) {
            return interaction.editReply({
                content: `You don't have enough credits. Your balance is **${formatBalance(wallet.balance)}**.`,
            });
        }

        // Take the bet before the player decides. Only checking the balance would let them spend it during the 30 seconds and lose for free.
        const held = await updateBalance(interaction.user.id, interaction.guild.id, -bet);
        if (!held) {
            return interaction.editReply({ content: 'You no longer have enough credits to cover that bet.' });
        }

        // Rolled up front but kept hidden until the player has committed, so the choice can't be informed by it.
        const firstNumber = Math.floor(Math.random() * 100) + 1;

        const embed = new EmbedBuilder()
            .setTitle('🎲 High-Low Gamble')
            .setDescription(`I rolled a hidden number between 1 and 100.\nWill the next roll be **Higher** or **Lower** than it?`)
            .addFields(
                { name: 'Your Bet',     value: `💰 ${formatBalance(bet)} credits`,     inline: true },
                { name: 'Your Balance', value: `💳 ${formatBalance(held.balance)} credits`, inline: true },
            )
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setFooter({ text: 'You have 30 seconds to decide!' });

        const prefix = `gamble_${interaction.id}`;
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`${prefix}_higher`).setLabel('Higher').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`${prefix}_lower`).setLabel('Lower').setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000,
            filter: i => i.user.id === interaction.user.id,
            max: 1,
        });

        collector.on('collect', async (i) => {
            const secondNumber = Math.floor(Math.random() * 100) + 1;
            const choice = i.customId === `${prefix}_higher` ? 'higher' : 'lower';
            const outcome = resolveGamble(firstNumber, secondNumber, choice);
            const userWon = outcome === 'win';

            if (outcome === 'tie') {
                await updateBalance(interaction.user.id, interaction.guild.id, bet);
                return i.update({
                    content: `😲 It was a tie! Both rolls were **${secondNumber}**. Your bet was returned.`,
                    embeds: [],
                    components: [],
                });
            }

            // The bet is already held: a win returns it plus the winnings, a loss keeps it.
            let newBalance;
            if (userWon) {
                const updated = await updateBalance(interaction.user.id, interaction.guild.id, bet * 2);
                newBalance = updated.balance;
            } else {
                newBalance = (await getWallet(interaction.user.id, interaction.guild.id)).balance;
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle(userWon ? '🎉 You Won!' : '💀 You Lost!')
                .setDescription(`The hidden number was **${firstNumber}** and the next roll was **${secondNumber}**!`)
                .addFields(
                    { name: 'Your Choice',  value: i.customId.replace(`${prefix}_`, '').toUpperCase(),            inline: true },
                    { name: 'Result',       value: userWon ? `💰 +${formatBalance(bet)}` : `💸 -${formatBalance(bet)}`, inline: true },
                    { name: 'New Balance',  value: `💳 ${formatBalance(newBalance)} credits`,                     inline: true },
                )
                .setColor(userWon ? 'Green' : 'Red');

            await i.update({ embeds: [resultEmbed], components: [] });
        });

        collector.on('end', async (collected, reason) => {
            // No choice was made (timeout, deleted message, ...), so give the held bet back.
            if (collected.size > 0) return;
            await updateBalance(interaction.user.id, interaction.guild.id, bet);
            if (reason === 'time') {
                interaction.editReply({ content: '⏰ Time is up! Gamble cancelled.', embeds: [], components: [] });
            }
        });
    },
};
