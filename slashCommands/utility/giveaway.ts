import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
import GiveawaySchema from '../../models/GiveawaySchema';

function formatTimeLeft(endsAt: Date) {
    const ms = endsAt.getTime() - Date.now();
    if (ms <= 0) return 'ended';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}m`;
    return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function parseDuration(str: string) {
    const match = str.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const units: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * units[match[2]];
}

// setTimeout delays beyond this overflow and fire immediately, so longer waits are chunked.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

function scheduleGiveawayEnd(client: Client, giveaway: any, remaining: number) {
    if (remaining > MAX_TIMEOUT_MS) {
        setTimeout(() => scheduleGiveawayEnd(client, giveaway, remaining - MAX_TIMEOUT_MS), MAX_TIMEOUT_MS);
        return;
    }
    setTimeout(() => endGiveaway(client, giveaway), Math.max(remaining, 0));
}

function giveawayEmbed(prize: string, hostId: string, endsAt: Date, winnerCount: number, entrantCount = 0, ended = false, winners: string[] = [], requireRoleId: string | null = null) {
    const embed = new EmbedBuilder()
        .setTitle('🎉 Giveaway')
        .setColor(ended ? 0x95a5a6 : 0xf1c40f)
        .addFields(
            { name: 'Prize', value: prize, inline: true },
            { name: 'Winners', value: `${winnerCount}`, inline: true },
            { name: 'Hosted by', value: `<@${hostId}>`, inline: true },
            { name: 'Entries', value: `${entrantCount}`, inline: true },
            { name: ended ? 'Ended' : 'Ends', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
        );

    if (requireRoleId) {
        embed.addFields({ name: 'Required Role', value: `<@&${requireRoleId}>`, inline: true });
    }

    if (ended) {
        embed.addFields({
            name: 'Winner(s)',
            value: winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'No valid entrants.',
        });
    }

    return embed;
}

function entryRow(ended = false) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('giveaway_enter')
            .setLabel(ended ? 'Giveaway Ended' : 'Enter Giveaway')
            .setEmoji('🎉')
            .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(ended)
    );
}

function pickWinners(entrants: string[], hostId: string, count: number) {
    const pool = entrants.filter(id => id !== hostId);
    const winners = [];
    const available = [...pool];
    while (winners.length < count && available.length > 0) {
        const idx = Math.floor(Math.random() * available.length);
        winners.push(available.splice(idx, 1)[0]);
    }
    return winners;
}

async function endGiveaway(client: Client, giveaway: any) {
    let eligibleEntrants = giveaway.entrants;

    if (giveaway.requireRoleId) {
        const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
        if (guild) {
            const members = await guild.members.fetch({ user: giveaway.entrants } as any).catch(() => new Map());
            eligibleEntrants = giveaway.entrants.filter((id: string) => {
                const member = (members as any).get(id);
                return member && member.roles.cache.has(giveaway.requireRoleId);
            });
        }
    }

    const winners = pickWinners(eligibleEntrants, giveaway.hostId, giveaway.winnerCount);

    giveaway.ended = true;
    giveaway.winners = winners;
    await giveaway.save();

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;

    const message = await (channel as any).messages.fetch(giveaway.messageId).catch(() => null);
    if (message) {
        const embed = giveawayEmbed(giveaway.prize, giveaway.hostId, giveaway.endsAt, giveaway.winnerCount, giveaway.entrants.length, true, winners, giveaway.requireRoleId);
        await message.edit({ embeds: [embed], components: [entryRow(true)] }).catch(() => {});
    }

    const mention = winners.length
        ? `Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`
        : `No valid entrants for **${giveaway.prize}**. (The host cannot win their own giveaway.)`;

    await (channel as any).send({ content: mention, reply: message ? { messageReference: giveaway.messageId } : undefined }).catch(() => {});
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Manage giveaways.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Start a giveaway in this channel.')
                .addStringOption(o => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
                .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 2h, 1d').setRequired(true))
                .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(20))
                .addRoleOption(o => o.setName('require_role').setDescription('Only members with this role can enter')))
        .addSubcommand(sub =>
            sub.setName('end')
                .setDescription('End an active giveaway early.')
                .addStringOption(o => o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('reroll')
                .setDescription('Reroll winners for an ended giveaway.')
                .addStringOption(o => o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List active giveaways in this server.')),

    permissions: PermissionFlagsBits.ManageGuild,

    endGiveaway,
    scheduleGiveawayEnd,

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'start') {
            const prize = interaction.options.getString('prize');
            const durationStr = interaction.options.getString('duration');
            const winnerCount = interaction.options.getInteger('winners') ?? 1;
            const requireRole = interaction.options.getRole('require_role');

            const ms = parseDuration(durationStr);
            if (!ms) return interaction.reply({ content: 'Invalid duration. Use formats like `10m`, `2h`, `1d`.', flags: MessageFlags.Ephemeral });
            if (ms < 10000) return interaction.reply({ content: 'Duration must be at least 10 seconds.', flags: MessageFlags.Ephemeral });

            const endsAt = new Date(Date.now() + ms);

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const embed = giveawayEmbed(prize, interaction.user.id, endsAt, winnerCount, 0, false, [], requireRole?.id ?? null);
            const msg = await (interaction.channel as any).send({ embeds: [embed], components: [entryRow(false)] });

            const giveaway = await GiveawaySchema.create({
                guildId: interaction.guild.id,
                channelId: interaction.channel.id,
                messageId: msg.id,
                hostId: interaction.user.id,
                prize,
                winnerCount,
                endsAt,
                requireRoleId: requireRole?.id ?? null,
            });

            scheduleGiveawayEnd(client, giveaway, ms);

            return interaction.editReply({ content: `Giveaway started! [Jump to message](https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}/${msg.id})` });
        }

        if (sub === 'end') {
            const messageId = interaction.options.getString('message_id');
            const giveaway = await GiveawaySchema.findOne({ messageId, guildId: interaction.guild.id });

            if (!giveaway) return interaction.reply({ content: 'No active giveaway found with that message ID.', flags: MessageFlags.Ephemeral });
            if (giveaway.ended) return interaction.reply({ content: 'That giveaway has already ended.', flags: MessageFlags.Ephemeral });

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await endGiveaway(client, giveaway);
            return interaction.editReply({ content: 'Giveaway ended and winner(s) selected.' });
        }

        if (sub === 'reroll') {
            const messageId = interaction.options.getString('message_id');
            const giveaway = await GiveawaySchema.findOne({ messageId, guildId: interaction.guild.id });

            if (!giveaway) return interaction.reply({ content: 'No giveaway found with that message ID.', flags: MessageFlags.Ephemeral });
            if (!giveaway.ended) return interaction.reply({ content: 'That giveaway has not ended yet. Use `/giveaway end` first.', flags: MessageFlags.Ephemeral });

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            let eligibleEntrants = giveaway.entrants;
            if (giveaway.requireRoleId) {
                const members = await interaction.guild.members.fetch({ user: giveaway.entrants } as any).catch(() => new Map());
                eligibleEntrants = giveaway.entrants.filter(id => {
                    const member = (members as any).get(id);
                    return member && member.roles.cache.has(giveaway.requireRoleId);
                });
            }

            const winners = pickWinners(eligibleEntrants, giveaway.hostId, giveaway.winnerCount);
            giveaway.winners = winners;
            await giveaway.save();

            const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
            if (channel) {
                const message = await (channel as any).messages.fetch(giveaway.messageId).catch(() => null);
                if (message) {
                    const embed = giveawayEmbed(giveaway.prize, giveaway.hostId, giveaway.endsAt, giveaway.winnerCount, giveaway.entrants.length, true, winners, giveaway.requireRoleId);
                    await message.edit({ embeds: [embed] }).catch(() => {});
                }

                const mention = winners.length
                    ? `🎉 Reroll! Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`
                    : `No valid entrants for the reroll of **${giveaway.prize}**. (The host cannot win their own giveaway.)`;
                await (channel as any).send({ content: mention }).catch(() => {});
            }

            return interaction.editReply({ content: 'Reroll complete.' });
        }

        if (sub === 'list') {
            const giveaways = await GiveawaySchema.find({ guildId: interaction.guild.id, ended: false }).sort({ endsAt: 1 });

            if (!giveaways.length) {
                return interaction.reply({ content: 'No active giveaways in this server.', flags: MessageFlags.Ephemeral });
            }

            const lines = giveaways.map(g => {
                const jump = `https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId}`;
                const timeLeft = formatTimeLeft(g.endsAt);
                const winners = g.winnerCount === 1 ? '1 winner' : `${g.winnerCount} winners`;
                return `• **${g.prize}** — ${winners} — ends in **${timeLeft}** — [Jump](${jump})`;
            });

            const embed = new EmbedBuilder()
                .setTitle('🎉 Active Giveaways')
                .setColor(0xf1c40f)
                .setDescription(lines.join('\n'));

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
