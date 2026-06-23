const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const GiveawaySchema = require('../../models/GiveawaySchema');

function parseDuration(str) {
    const match = str.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * units[match[2]];
}

function giveawayEmbed(prize, hostId, endsAt, winnerCount, entrantCount = 0, ended = false, winners = []) {
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

    if (ended) {
        embed.addFields({
            name: 'Winner(s)',
            value: winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'No valid entrants.',
        });
    }

    return embed;
}

function entryRow(ended = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('giveaway_enter')
            .setLabel(ended ? 'Giveaway Ended' : 'Enter Giveaway')
            .setEmoji('🎉')
            .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(ended)
    );
}

function pickWinners(entrants, hostId, count) {
    const pool = entrants.filter(id => id !== hostId);
    const winners = [];
    const available = [...pool];
    while (winners.length < count && available.length > 0) {
        const idx = Math.floor(Math.random() * available.length);
        winners.push(available.splice(idx, 1)[0]);
    }
    return winners;
}

async function endGiveaway(client, giveaway) {
    const winners = pickWinners(giveaway.entrants, giveaway.hostId, giveaway.winnerCount);

    giveaway.ended = true;
    giveaway.winners = winners;
    await giveaway.save();

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (message) {
        const embed = giveawayEmbed(giveaway.prize, giveaway.hostId, giveaway.endsAt, giveaway.winnerCount, giveaway.entrants.length, true, winners);
        await message.edit({ embeds: [embed], components: [entryRow(true)] }).catch(() => {});
    }

    const mention = winners.length
        ? `Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`
        : `No valid entrants for **${giveaway.prize}**. (The host cannot win their own giveaway.)`;

    await channel.send({ content: mention, reply: message ? { messageReference: giveaway.messageId } : undefined }).catch(() => {});
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
                .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(20)))
        .addSubcommand(sub =>
            sub.setName('end')
                .setDescription('End an active giveaway early.')
                .addStringOption(o => o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('reroll')
                .setDescription('Reroll winners for an ended giveaway.')
                .addStringOption(o => o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true))),

    endGiveaway,

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'start') {
            const prize = interaction.options.getString('prize');
            const durationStr = interaction.options.getString('duration');
            const winnerCount = interaction.options.getInteger('winners') ?? 1;

            const ms = parseDuration(durationStr);
            if (!ms) return interaction.reply({ content: 'Invalid duration. Use formats like `10m`, `2h`, `1d`.', flags: MessageFlags.Ephemeral });
            if (ms < 10000) return interaction.reply({ content: 'Duration must be at least 10 seconds.', flags: MessageFlags.Ephemeral });

            const endsAt = new Date(Date.now() + ms);

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const embed = giveawayEmbed(prize, interaction.user.id, endsAt, winnerCount, 0, false);
            const msg = await interaction.channel.send({ embeds: [embed], components: [entryRow(false)] });

            const giveaway = await GiveawaySchema.create({
                guildId: interaction.guild.id,
                channelId: interaction.channel.id,
                messageId: msg.id,
                hostId: interaction.user.id,
                prize,
                winnerCount,
                endsAt,
            });

            setTimeout(() => endGiveaway(client, giveaway), ms);

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

            const winners = pickWinners(giveaway.entrants, giveaway.hostId, giveaway.winnerCount);
            giveaway.winners = winners;
            await giveaway.save();

            const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
            if (channel) {
                const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
                if (message) {
                    const embed = giveawayEmbed(giveaway.prize, giveaway.hostId, giveaway.endsAt, giveaway.winnerCount, giveaway.entrants.length, true, winners);
                    await message.edit({ embeds: [embed] }).catch(() => {});
                }

                const mention = winners.length
                    ? `🎉 Reroll! Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`
                    : `No valid entrants for the reroll of **${giveaway.prize}**. (The host cannot win their own giveaway.)`;
                await channel.send({ content: mention }).catch(() => {});
            }

            return interaction.editReply({ content: 'Reroll complete.' });
        }
    },
};
