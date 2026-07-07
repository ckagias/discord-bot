const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getWallet, updateBalance, formatBalance } = require('../../utils/economy');
const { launchHeist } = require('../../utils/heist');
const HeistSchema = require('../../models/HeistSchema');
const log = require('../../utils/log');
const logger = log.scope('heist');

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

            const wallet = await getWallet(interaction.user.id, interaction.guild.id);
            if (wallet.balance < heist.entryFee) {
                return interaction.reply({
                    content: `You don't have enough coins to join. Entry fee is **${formatBalance(heist.entryFee)}** and your balance is **${formatBalance(wallet.balance)}**.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Atomically add member — rejects if already in the list, preventing duplicate joins and double fee charges
            const updated = await HeistSchema.findOneAndUpdate(
                { messageId: interaction.message.id, finished: false, 'members.userId': { $ne: interaction.user.id } },
                { $push: { members: { userId: interaction.user.id, username: interaction.user.username } } },
                { returnDocument: 'after' }
            );

            if (!updated) {
                return interaction.reply({ content: 'You have already joined this heist.', flags: MessageFlags.Ephemeral });
            }

            // Fee deducted only after confirmed membership — no lost coins if the save had failed
            await updateBalance(interaction.user.id, interaction.guild.id, -heist.entryFee);

            await interaction.update({ embeds: [lobbyEmbed(updated)], components: [lobbyRow(updated.members.length)] });
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
            try {
                await launchHeist(interaction.message, interaction.guild);
            } catch (err) {
                logger.error('launchHeist failed after begin button:', err);
                // Refund all members since the heist can't proceed
                const fresh = await HeistSchema.findOne({ messageId: interaction.message.id });
                if (fresh) {
                    await Promise.all(fresh.members.map(m => updateBalance(m.userId, interaction.guild.id, fresh.entryFee)));
                    await HeistSchema.updateOne({ _id: fresh._id }, { $set: { finished: true } });
                }
                await interaction.message.edit({ content: 'The heist failed to launch due to an error. All entry fees have been refunded.', components: [DISABLED_ROW] });
            }
        },
    },
];
