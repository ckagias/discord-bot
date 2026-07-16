import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, Guild } from 'discord.js';
import { updateBalance, formatBalance } from './economy';
import HeistSchema from '../models/HeistSchema';

// Success chance: 30% base + 5% per member, capped at 75%
function successChance(memberCount: number): number {
    return Math.min(0.30 + (memberCount - 1) * 0.05, 0.75);
}

// Each surviving member gets an equal share of the total pot, plus a random bonus multiplier (1.5x–3x).
// Remainder coins (from floor division) go to the first survivor so no coins are destroyed.
function calcPayout(totalPot: number, survivors: number) {
    const multiplier = 1.5 + Math.random() * 1.5; // 1.5x–3x
    const total = Math.floor(totalPot * multiplier);
    const perPerson = Math.floor(total / survivors);
    const remainder = total - perPerson * survivors;
    return { perPerson, remainder, multiplier };
}

async function launchHeist(message: Message, guild: Guild) {
    // Atomic guard — only one of setTimeout and heist_begin can win this update
    const heist = await HeistSchema.findOneAndUpdate(
        { messageId: message.id, finished: false },
        { $set: { finished: true } },
        { returnDocument: 'after' }
    );
    if (!heist) return;

    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('heist_join').setLabel('Join Heist').setEmoji('🔫').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('heist_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setDisabled(true),
    );

    if (heist.members.length < 2) {
        // Refund leader
        await updateBalance(heist.leaderId, guild.id, heist.entryFee);

        const embed = new EmbedBuilder()
            .setTitle('Heist Cancelled')
            .setDescription('Not enough crew members joined. The heist has been called off.\n\nThe entry fee has been refunded to the organizer.')
            .setColor(0xc0392b);

        return message.edit({ embeds: [embed], components: [disabledRow] });
    }

    const members = heist.members;
    const totalPot = heist.entryFee * members.length;
    const chance = successChance(members.length);
    const heistSucceeds = Math.random() < chance;

    if (!heistSucceeds) {
        // Everyone loses their entry fee
        const embed = new EmbedBuilder()
            .setTitle('Heist Failed — Busted!')
            .setDescription(
                `The crew got caught by the police!\n\n` +
                `**Crew:** ${members.map(m => m.username).join(', ')}\n` +
                `**Lost:** ${formatBalance(heist.entryFee)} coins each\n\n` +
                `*Better luck next time.*`
            )
            .setColor(0xc0392b)
            .setFooter({ text: `Success chance was ${Math.round(chance * 100)}%` });

        return message.edit({ embeds: [embed], components: [disabledRow] });
    }

    // Determine who gets caught (0–40% of crew, rounded down, always at least 1 survivor)
    const caughtCount = Math.min(
        Math.floor(members.length * Math.random() * 0.4),
        members.length - 1
    );
    const shuffled = [...members].sort(() => Math.random() - 0.5);
    const caught = shuffled.slice(0, caughtCount);
    const survivors = shuffled.slice(caughtCount);

    const { perPerson, remainder, multiplier } = calcPayout(totalPot, survivors.length);

    // Pay survivors — first survivor gets any remainder from floor division
    await Promise.all(survivors.map((m, i) => updateBalance(m.userId, guild.id, perPerson + (i === 0 ? remainder : 0))));

    const caughtLine = caught.length
        ? `**Caught:** ${caught.map(m => m.username).join(', ')} — lost their cut\n`
        : '';

    const embed = new EmbedBuilder()
        .setTitle('Heist Successful!')
        .setDescription(
            `The crew cracked the vault and made it out!\n\n` +
            `**Crew:** ${members.map(m => m.username).join(', ')}\n` +
            caughtLine +
            `**Loot multiplier:** ${multiplier.toFixed(2)}x\n` +
            `**Total pot:** ${formatBalance(totalPot)} coins\n` +
            `**Payout per survivor:** ${formatBalance(perPerson)} coins`
        )
        .setColor(0x538d4e)
        .setFooter({ text: `Success chance was ${Math.round(chance * 100)}%` });

    return message.edit({ embeds: [embed], components: [disabledRow] });
}

export { launchHeist };
