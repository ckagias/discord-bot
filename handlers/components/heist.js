const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getWallet, updateBalance, formatBalance } = require('../../utils/economy');
const { launchHeist } = require('../../utils/heist');
const HeistSchema = require('../../models/HeistSchema');

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

function lobbyRow(memberCount = 1) {
    const canBegin = memberCount >= 2;
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
            .setDisabled(!canBegin),
        new ButtonBuilder()
            .setCustomId('heist_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger),
    );
}

const DISABLED_ROW = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('heist_join').setLabel('Join Heist').setEmoji('🔫').setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId('heist_begin').setLabel('Begin Early').setEmoji('🚀').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId('heist_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setDisabled(true),
);

module.exports = [
    {
        type: 'button',
        id: 'heist_join',

        async execute(interaction) {
            const heist = await HeistSchema.findOne({ messageId: interaction.message.id, finished: false });
            if (!heist) {
                return interaction.reply({ content: 'This heist is no longer active.', flags: MessageFlags.Ephemeral });
            }

            if (heist.members.some(m => m.userId === interaction.user.id)) {
                return interaction.reply({ content: 'You have already joined this heist.', flags: MessageFlags.Ephemeral });
            }

            const wallet = await getWallet(interaction.user.id, interaction.guild.id);
            if (wallet.balance < heist.entryFee) {
                return interaction.reply({
                    content: `You don't have enough coins to join. Entry fee is **${formatBalance(heist.entryFee)}** and your balance is **${formatBalance(wallet.balance)}**.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            await updateBalance(interaction.user.id, interaction.guild.id, -heist.entryFee);

            heist.members.push({ userId: interaction.user.id, username: interaction.user.username });
            await heist.save();

            await interaction.update({ embeds: [lobbyEmbed(heist)], components: [lobbyRow(heist.members.length)] });
        },
    },
    {
        type: 'button',
        id: 'heist_cancel',

        async execute(interaction) {
            const heist = await HeistSchema.findOne({ messageId: interaction.message.id, finished: false });
            if (!heist) {
                return interaction.reply({ content: 'This heist is no longer active.', flags: MessageFlags.Ephemeral });
            }

            if (heist.leaderId !== interaction.user.id) {
                return interaction.reply({ content: 'Only the heist organizer can cancel it.', flags: MessageFlags.Ephemeral });
            }

            heist.finished = true;
            await heist.save();

            // Refund all members
            await Promise.all(heist.members.map(m => updateBalance(m.userId, interaction.guild.id, heist.entryFee)));

            const embed = new EmbedBuilder()
                .setTitle('Heist Cancelled')
                .setDescription('The organizer called off the heist. All entry fees have been refunded.')
                .setColor(0xc0392b);

            await interaction.update({ embeds: [embed], components: [DISABLED_ROW] });
        },
    },
    {
        type: 'button',
        id: 'heist_begin',

        async execute(interaction) {
            const heist = await HeistSchema.findOne({ messageId: interaction.message.id, finished: false });
            if (!heist) {
                return interaction.reply({ content: 'This heist is no longer active.', flags: MessageFlags.Ephemeral });
            }

            if (heist.leaderId !== interaction.user.id) {
                return interaction.reply({ content: 'Only the heist organizer can begin the heist early.', flags: MessageFlags.Ephemeral });
            }

            if (heist.members.length < 2) {
                return interaction.reply({ content: 'You need at least 2 crew members to begin the heist.', flags: MessageFlags.Ephemeral });
            }

            await interaction.update({ components: [DISABLED_ROW] });
            await launchHeist(interaction.message, interaction.guild);
        },
    },
];
