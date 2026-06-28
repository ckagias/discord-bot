const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getWallet, updateBalance, formatBalance } = require('../../utils/economy');
const HeistSchema = require('../../models/HeistSchema');

const JOIN_WINDOW_MS = 60_000;

function lobbyEmbed(heist) {
    const memberList = heist.members.length
        ? heist.members.map(m => `• ${m.username}`).join('\n')
        : '*No one yet — be the first!*';

    return new EmbedBuilder()
        .setTitle('Bank Heist — Lobby Open')
        .setDescription(
            `A heist is being planned! Pay the entry fee to join the crew.\n\n` +
            `**Entry Fee:** ${formatBalance(heist.entryFee)} coins\n` +
            `**Crew (${heist.members.length}):**\n${memberList}`
        )
        .setColor(Math.floor(Math.random() * 0xFFFFFF))
        .setFooter({ text: `Heist launches in 60s — minimum 2 crew members required` });
}

function lobbyRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('heist_join')
            .setLabel('Join Heist')
            .setEmoji('🔫')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('heist_begin')
            .setLabel('Begin Early')
            .setEmoji('🚀')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true), // enabled once 2+ members join
        new ButtonBuilder()
            .setCustomId('heist_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger),
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('heist')
        .setDescription('Organize a bank heist — recruit a crew and split the loot!')
        .addIntegerOption(opt =>
            opt.setName('entry_fee')
                .setDescription('Coins each participant must pay to join')
                .setRequired(true)
                .setMinValue(10)),

    async execute(interaction) {
        await interaction.deferReply();

        const entryFee = interaction.options.getInteger('entry_fee');

        // One active heist per guild at a time
        const existing = await HeistSchema.findOne({ guildId: interaction.guild.id, finished: false });
        if (existing) {
            return interaction.editReply({ content: 'There is already an active heist in this server. Wait for it to finish first.' });
        }

        const wallet = await getWallet(interaction.user.id, interaction.guild.id);
        if (wallet.balance < entryFee) {
            return interaction.editReply({ content: `You don't have enough coins to start this heist. Your balance is **${formatBalance(wallet.balance)}**.` });
        }

        // Deduct leader's fee immediately
        await updateBalance(interaction.user.id, interaction.guild.id, -entryFee);

        const heist = await HeistSchema.create({
            messageId: 'pending',
            channelId: interaction.channel.id,
            guildId: interaction.guild.id,
            leaderId: interaction.user.id,
            entryFee,
            members: [{ userId: interaction.user.id, username: interaction.user.username }],
        });

        const message = await interaction.editReply({
            embeds: [lobbyEmbed(heist)],
            components: [lobbyRow()], // Begin Early starts disabled; unlocks after 2nd member joins
        });

        heist.messageId = message.id;
        await heist.save();

        // Auto-launch after JOIN_WINDOW_MS
        setTimeout(async () => {
            const { launchHeist } = require('../../utils/heist');
            await launchHeist(message, interaction.guild);
        }, JOIN_WINDOW_MS);
    },
};
