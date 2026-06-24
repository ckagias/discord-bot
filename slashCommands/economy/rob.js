const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomySchema = require('../../models/EconomySchema');
const { getWallet, updateBalance, formatBalance } = require('../../utils/economy');

const ROB_COOLDOWN_MS = 3_600_000; // 1 hour
const ROB_SUCCESS_CHANCE = 0.45;   // 45% success rate
const ROB_MIN_BALANCE = 100;       // target needs at least this many credits
const ROB_FINE_RATE = 0.25;        // on fail, robber pays 25% of attempted steal as fine

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to steal credits from another member (risky!).')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to rob')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('user');

        if (target.id === interaction.user.id) {
            return interaction.editReply({ content: 'You cannot rob yourself.' });
        }
        if (target.bot) {
            return interaction.editReply({ content: 'You cannot rob a bot.' });
        }

        // Cooldown check
        const robberWallet = await EconomySchema.findOneAndUpdate(
            { userId: interaction.user.id, guildId: interaction.guild.id },
            { $setOnInsert: { userId: interaction.user.id, guildId: interaction.guild.id } },
            { upsert: true, returnDocument: 'after' }
        );

        const now = Date.now();
        const lastRob = robberWallet.lastRobAt ? robberWallet.lastRobAt.getTime() : 0;
        const remaining = ROB_COOLDOWN_MS - (now - lastRob);

        if (remaining > 0) {
            const availableAt = Math.floor((now + remaining) / 1000);
            return interaction.editReply({ content: `You're laying low after your last robbery. You can rob again <t:${availableAt}:R>.` });
        }

        const targetWallet = await getWallet(target.id, interaction.guild.id);

        if (targetWallet.balance < ROB_MIN_BALANCE) {
            return interaction.editReply({ content: `**${target.username}** doesn't have enough credits to rob (minimum ${formatBalance(ROB_MIN_BALANCE)}).` });
        }

        // Set cooldown before the outcome so spamming on error doesn't bypass it
        await EconomySchema.updateOne(
            { userId: interaction.user.id, guildId: interaction.guild.id },
            { $set: { lastRobAt: new Date(now) } }
        );

        const success = Math.random() < ROB_SUCCESS_CHANCE;

        // Steal between 10%–40% of target's balance
        const stealAmount = Math.floor(targetWallet.balance * (0.1 + Math.random() * 0.3));

        if (success) {
            await updateBalance(target.id, interaction.guild.id, -stealAmount);
            const updated = await updateBalance(interaction.user.id, interaction.guild.id, stealAmount);

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('🦹 Robbery Successful!')
                .setDescription(`You successfully robbed **${target.username}**!`)
                .addFields(
                    { name: 'Stolen',      value: `💰 **+${formatBalance(stealAmount)}** credits`, inline: true },
                    { name: 'Your Balance', value: `💳 **${formatBalance(updated.balance)}** credits`, inline: true },
                )
                .setFooter({ text: 'You can rob again in 1 hour.' });

            return interaction.editReply({ embeds: [embed] });
        } else {
            const fine = Math.floor(stealAmount * ROB_FINE_RATE);
            const fineResult = await updateBalance(interaction.user.id, interaction.guild.id, -fine);
            const newBalance = fineResult ? fineResult.balance : robberWallet.balance;

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('🚔 Caught Red-Handed!')
                .setDescription(`You tried to rob **${target.username}** but got caught!`)
                .addFields(
                    { name: 'Fine',        value: `💸 **-${formatBalance(fine)}** credits`,        inline: true },
                    { name: 'Your Balance', value: `💳 **${formatBalance(newBalance)}** credits`,   inline: true },
                )
                .setFooter({ text: 'You can try again in 1 hour.' });

            return interaction.editReply({ embeds: [embed] });
        }
    },
};
