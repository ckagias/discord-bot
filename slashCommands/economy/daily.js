const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomySchema = require('../../models/EconomySchema');
const { updateBalance, formatBalance, DAILY_COOLDOWN_MS, DAILY_STREAK_WINDOW_MS, dailyStreakAmount } = require('../../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily credits. Consecutive days increase your payout!'),

    async execute(interaction) {
        await interaction.deferReply();

        const wallet = await EconomySchema.findOneAndUpdate(
            { userId: interaction.user.id, guildId: interaction.guild.id },
            { $setOnInsert: { userId: interaction.user.id, guildId: interaction.guild.id } },
            { upsert: true, returnDocument: 'after' }
        );

        const now = Date.now();
        const lastDaily = wallet.lastDailyAt ? wallet.lastDailyAt.getTime() : 0;
        const remaining = DAILY_COOLDOWN_MS - (now - lastDaily);

        if (remaining > 0) {
            const availableAt = Math.floor((now + remaining) / 1000);
            const streakMsg = wallet.dailyStreak > 0
                ? ` Your current streak is **${wallet.dailyStreak} day${wallet.dailyStreak === 1 ? '' : 's'}** 🔥`
                : '';
            return interaction.editReply({
                content: `You already claimed your daily credits. Come back <t:${availableAt}:R>.${streakMsg}`,
            });
        }

        // Streak: still alive if last claim was within the 48h window, otherwise reset to 1.
        const streakAlive = lastDaily > 0 && (now - lastDaily) < DAILY_STREAK_WINDOW_MS;
        const newStreak = streakAlive ? wallet.dailyStreak + 1 : 1;
        const earned = dailyStreakAmount(newStreak);

        await EconomySchema.updateOne(
            { userId: interaction.user.id, guildId: interaction.guild.id },
            { $set: { lastDailyAt: new Date(now), dailyStreak: newStreak } }
        );

        const updated = await updateBalance(interaction.user.id, interaction.guild.id, earned);

        const streakBroken = lastDaily > 0 && !streakAlive && wallet.dailyStreak > 1;

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('Daily Credits Claimed!')
            .addFields(
                { name: 'Received',    value: `💰 **+${formatBalance(earned)}** credits`,           inline: true },
                { name: 'New Balance', value: `💳 **${formatBalance(updated.balance)}** credits`,   inline: true },
                { name: 'Streak',      value: `🔥 Day **${newStreak}**`,                            inline: true },
            );

        if (streakBroken) {
            embed.setDescription('⚠️ Your streak was reset! Claim daily to keep it going.');
        } else if (newStreak >= 7) {
            embed.setDescription('🏆 Max streak! You\'re earning **3.5×** the base payout.');
        } else {
            embed.setFooter({ text: `Come back within 48 hours to keep your streak! Next payout: ${formatBalance(dailyStreakAmount(newStreak + 1))} credits.` });
        }

        return interaction.editReply({ embeds: [embed] });
    },
};
