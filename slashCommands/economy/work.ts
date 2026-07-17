import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
const { claimCooldown, formatBalance } = require('../../utils/economy');
const EconomySchema = require('../../models/EconomySchema');
const { workResponses } = require('../../data/responses');

const WORK_COOLDOWN_MS = 3_600_000; // 1 hour

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work a job and earn credits (1-hour cooldown).'),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const wallet = await EconomySchema.findOneAndUpdate(
            { userId: interaction.user.id, guildId: interaction.guild.id },
            { $setOnInsert: { userId: interaction.user.id, guildId: interaction.guild.id } },
            { upsert: true, returnDocument: 'after' }
        );

        const now = Date.now();
        const lastWork = wallet.lastWorkAt ? wallet.lastWorkAt.getTime() : 0;
        const remaining = WORK_COOLDOWN_MS - (now - lastWork);

        if (remaining > 0) {
            const availableAt = Math.floor((now + remaining) / 1000);
            return interaction.editReply({
                content: `You're tired from your last job. You can work again <t:${availableAt}:R>.`,
            });
        }

        const job = workResponses[Math.floor(Math.random() * workResponses.length)];
        const earned = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;

        // Atomic: stamp cooldown and credit coins in one operation so a crash between
        // steps can't lock the user out without paying them.
        const updated = await claimCooldown(interaction.user.id, interaction.guild.id, 'lastWorkAt', WORK_COOLDOWN_MS, {
            $inc: { balance: earned },
        });

        if (!updated) {
            const fresh = await EconomySchema.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
            const availableAt = Math.floor((fresh.lastWorkAt.getTime() + WORK_COOLDOWN_MS) / 1000);
            return interaction.editReply({ content: `You're tired from your last job. You can work again <t:${availableAt}:R>.` });
        }

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('💼 Work Complete')
            .setDescription(job.text)
            .addFields(
                { name: 'Earned',      value: `💰 **+${formatBalance(earned)}** credits`,          inline: true },
                { name: 'New Balance', value: `💳 **${formatBalance(updated.balance)}** credits`,  inline: true },
            )
            .setFooter({ text: 'You can work again in 1 hour.' });

        return interaction.editReply({ embeds: [embed] });
    },
};
