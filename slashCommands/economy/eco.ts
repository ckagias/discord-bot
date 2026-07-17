import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
const EconomySchema = require('../../models/EconomySchema');
const { getWallet, updateBalance, formatBalance } = require('../../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eco')
        .setDescription('Admin tools for managing the server economy.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('give')
                .setDescription('Add credits to a member\'s balance.')
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                .addIntegerOption(o => o.setName('amount').setDescription('Amount to give').setRequired(true).setMinValue(1)))
        .addSubcommand(sub =>
            sub.setName('take')
                .setDescription('Remove credits from a member\'s balance.')
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                .addIntegerOption(o => o.setName('amount').setDescription('Amount to take').setRequired(true).setMinValue(1)))
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set a member\'s balance to an exact amount.')
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                .addIntegerOption(o => o.setName('amount').setDescription('New balance').setRequired(true).setMinValue(0)))
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Reset a member\'s balance and stats to zero.')
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (sub === 'give') {
            const updated = await updateBalance(target.id, interaction.guild.id, amount);
            return interaction.editReply({
                content: `Gave **${formatBalance(amount)}** credits to **${target.username}**. New balance: **${formatBalance(updated.balance)}**.`,
            });
        }

        if (sub === 'take') {
            const updated = await updateBalance(target.id, interaction.guild.id, -amount);
            if (!updated) {
                const wallet = await getWallet(target.id, interaction.guild.id);
                return interaction.editReply({
                    content: `**${target.username}** only has **${formatBalance(wallet.balance)}** credits (not enough to take ${formatBalance(amount)}).`,
                });
            }
            return interaction.editReply({
                content: `Took **${formatBalance(amount)}** credits from **${target.username}**. New balance: **${formatBalance(updated.balance)}**.`,
            });
        }

        if (sub === 'set') {
            await EconomySchema.findOneAndUpdate(
                { userId: target.id, guildId: interaction.guild.id },
                { $set: { balance: amount }, $setOnInsert: { userId: target.id, guildId: interaction.guild.id } },
                { upsert: true }
            );
            return interaction.editReply({
                content: `Set **${target.username}**'s balance to **${formatBalance(amount)}** credits.`,
            });
        }

        if (sub === 'reset') {
            await EconomySchema.findOneAndUpdate(
                { userId: target.id, guildId: interaction.guild.id },
                { $set: { balance: 0, lastDailyAt: null, lastWorkAt: null, lastRobAt: null, dailyStreak: 0 } },
                { upsert: true }
            );
            return interaction.editReply({
                content: `Reset **${target.username}**'s economy stats (balance, streak, and all cooldowns).`,
            });
        }
    },
};
