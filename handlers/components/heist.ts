import { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import { getWallet, updateBalance, formatBalance } from '../../utils/economy';
import { launchHeist } from '../../utils/heist';
import HeistSchema from '../../models/HeistSchema';
import log from '../../utils/log';
import { ComponentDefinition } from '../../types/discord';
const logger = log.scope('heist');

function lobbyEmbed(heist: any) {
    const memberList = heist.members.length
        ? heist.members.map((m: any) => `• ${m.username}`).join('\n')
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
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
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

const DISABLED_ROW = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('heist_join').setLabel('Join Heist').setEmoji('🔫').setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId('heist_begin').setLabel('Begin Early').setEmoji('🚀').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId('heist_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setDisabled(true),
);

const components: ComponentDefinition[] = [
    {
        type: 'button',
        id: 'heist_join',

        async execute(interaction: ButtonInteraction) {
            const heist = await HeistSchema.findOne({ messageId: interaction.message.id, finished: false }).lean();
            if (!heist) {
                return interaction.reply({ content: 'This heist is no longer active.', flags: MessageFlags.Ephemeral });
            }

            if (heist.members.some(m => m.userId === interaction.user.id)) {
                return interaction.reply({ content: 'You have already joined this heist.', flags: MessageFlags.Ephemeral });
            }

            const wallet = await getWallet(interaction.user.id, interaction.guild!.id);
            if (wallet.balance < heist.entryFee) {
                return interaction.reply({
                    content: `You don't have enough coins to join. Entry fee is **${formatBalance(heist.entryFee)}** and your balance is **${formatBalance(wallet.balance)}**.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Take the fee first. Adding the member first let someone into the crew, and into the pot, without paying
            // when the debit failed or the heist was launched in between.
            const debit = await updateBalance(interaction.user.id, interaction.guild!.id, -heist.entryFee);
            if (!debit) {
                return interaction.reply({ content: 'You no longer have enough coins to join.', flags: MessageFlags.Ephemeral });
            }

            // Atomically add member — rejects if already in the list or the heist has ended
            const updated = await HeistSchema.findOneAndUpdate(
                { messageId: interaction.message.id, finished: false, 'members.userId': { $ne: interaction.user.id } },
                { $push: { members: { userId: interaction.user.id, username: interaction.user.username } } },
                { returnDocument: 'after' }
            );

            if (!updated) {
                await updateBalance(interaction.user.id, interaction.guild!.id, heist.entryFee);
                return interaction.reply({ content: 'You have already joined this heist, or it is no longer active.', flags: MessageFlags.Ephemeral });
            }

            await (interaction as any).update({ embeds: [lobbyEmbed(updated)], components: [lobbyRow(updated.members.length)] });
        },
    },
    {
        type: 'button',
        id: 'heist_cancel',

        async execute(interaction: ButtonInteraction) {
            const heist = await HeistSchema.findOne({ messageId: interaction.message.id, finished: false }).lean();
            if (!heist) {
                return interaction.reply({ content: 'This heist is no longer active.', flags: MessageFlags.Ephemeral });
            }

            if (heist.leaderId !== interaction.user.id) {
                return interaction.reply({ content: 'Only the heist organizer can cancel it.', flags: MessageFlags.Ephemeral });
            }

            // Claim the heist atomically so a double click, or a cancel that races the launch, refunds only once.
            const claimed = await HeistSchema.findOneAndUpdate(
                { _id: heist._id, finished: false },
                { $set: { finished: true } },
                { returnDocument: 'after' }
            );
            if (!claimed) {
                return interaction.reply({ content: 'This heist is no longer active.', flags: MessageFlags.Ephemeral });
            }

            await Promise.all(claimed.members.map(m => updateBalance(m.userId as string, interaction.guild!.id, claimed.entryFee)));

            const embed = new EmbedBuilder()
                .setTitle('Heist Cancelled')
                .setDescription('The organizer called off the heist. All entry fees have been refunded.')
                .setColor(0xc0392b);

            await (interaction as any).update({ embeds: [embed], components: [DISABLED_ROW] });
        },
    },
    {
        type: 'button',
        id: 'heist_begin',

        async execute(interaction: ButtonInteraction) {
            const heist = await HeistSchema.findOne({ messageId: interaction.message.id, finished: false }).lean();
            if (!heist) {
                return interaction.reply({ content: 'This heist is no longer active.', flags: MessageFlags.Ephemeral });
            }

            if (heist.leaderId !== interaction.user.id) {
                return interaction.reply({ content: 'Only the heist organizer can begin the heist early.', flags: MessageFlags.Ephemeral });
            }

            if (heist.members.length < 2) {
                return interaction.reply({ content: 'You need at least 2 crew members to begin the heist.', flags: MessageFlags.Ephemeral });
            }

            await (interaction as any).update({ components: [DISABLED_ROW] });
            try {
                await launchHeist(interaction.message, interaction.guild!);
            } catch (err) {
                logger.error('launchHeist failed after begin button:', err);
                // Refund everyone, but only if the launch had not claimed the heist yet. Once it has, the outcome was
                // already applied (survivors paid or the crew busted), and refunding would pay the entry fees twice.
                const claimed = await HeistSchema.findOneAndUpdate(
                    { messageId: interaction.message.id, finished: false },
                    { $set: { finished: true } },
                    { returnDocument: 'after' }
                );
                if (claimed) {
                    await Promise.all(claimed.members.map(m => updateBalance(m.userId as string, interaction.guild!.id, claimed.entryFee)));
                    await interaction.message.edit({ content: 'The heist failed to launch due to an error. All entry fees have been refunded.', components: [DISABLED_ROW] });
                }
            }
        },
    },
];

export = components;
