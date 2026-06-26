const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const PollSchema = require('../../models/PollSchema');

const OPTION_EMOJIS = ['🇦', '🇧', '🇨', '🇩'];

function parseDuration(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)(m|h)$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    return null;
}

function buildBar(votes, total) {
    const filled = total === 0 ? 0 : Math.round((votes / total) * 10);
    const empty = 10 - filled;
    const pct = total === 0 ? 0 : Math.round((votes / total) * 100);
    return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${pct}% (${votes})`;
}

function buildEmbed(question, options, votes, hostTag, endsAt, ended) {
    const totalVotes = options.reduce((sum, _, i) => sum + (votes.get(String(i))?.length ?? 0), 0);

    const description = options.map((opt, i) => {
        const count = votes.get(String(i))?.length ?? 0;
        return `${OPTION_EMOJIS[i]} **${opt}**\n${buildBar(count, totalVotes)}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
        .setColor(ended ? 0x2b2d31 : 0x5865F2)
        .setTitle((ended ? '📊 [ENDED] ' : '📊 ') + question)
        .setDescription(description)
        .setFooter({ text: `Poll by ${hostTag} • ${totalVotes} vote${totalVotes !== 1 ? 's' : ''}` })
        .setTimestamp();

    if (endsAt && !ended)
        embed.addFields({ name: 'Ends', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true });

    return embed;
}

function buildButtons(options, disabled = false) {
    return new ActionRowBuilder().addComponents(
        options.map((opt, i) =>
            new ButtonBuilder()
                .setCustomId(`poll_vote_${i}`)
                .setEmoji(OPTION_EMOJIS[i])
                .setLabel(opt)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled)
        )
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll with up to 4 options.')
        .addStringOption(o => o.setName('question').setDescription('The poll question').setRequired(true))
        .addStringOption(o => o.setName('option1').setDescription('First option').setRequired(true))
        .addStringOption(o => o.setName('option2').setDescription('Second option').setRequired(true))
        .addStringOption(o => o.setName('option3').setDescription('Third option (optional)').setRequired(false))
        .addStringOption(o => o.setName('option4').setDescription('Fourth option (optional)').setRequired(false))
        .addStringOption(o =>
            o.setName('duration')
             .setDescription('How long the poll runs, e.g. 10m or 2h (max 24h)')
             .setRequired(false)
        ),

    buildEmbed,
    buildButtons,

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const options = [
            interaction.options.getString('option1'),
            interaction.options.getString('option2'),
            interaction.options.getString('option3'),
            interaction.options.getString('option4'),
        ].filter(Boolean);

        const durationStr = interaction.options.getString('duration');
        const durationMs = parseDuration(durationStr);

        if (durationStr && durationMs === null)
            return interaction.reply({ content: 'Invalid duration. Use a format like `10m` or `2h` (max 24h).', ephemeral: true });

        if (durationMs && durationMs > 24 * 60 * 60 * 1000)
            return interaction.reply({ content: 'Duration cannot exceed 24 hours.', ephemeral: true });

        const endsAt = durationMs ? new Date(Date.now() + durationMs) : null;
        const emptyVotes = new Map(options.map((_, i) => [String(i), []]));

        const embed = buildEmbed(question, options, emptyVotes, interaction.user.tag, endsAt, false);
        const row = buildButtons(options);

        await interaction.reply({ embeds: [embed], components: [row] });
        const message = await interaction.fetchReply();

        const poll = await PollSchema.create({
            guildId:   interaction.guildId,
            channelId: interaction.channelId,
            messageId: message.id,
            hostId:    interaction.user.id,
            question,
            options,
            votes:     emptyVotes,
            endsAt,
        });

        if (endsAt) {
            const delay = endsAt.getTime() - Date.now();
            setTimeout(() => closePoll(interaction.client, poll._id), delay);
        }
    },
};

async function closePoll(client, pollId) {
    const poll = await PollSchema.findById(pollId);
    if (!poll || poll.ended) return;

    poll.ended = true;
    await poll.save();

    const guild   = client.guilds.cache.get(poll.guildId);
    const channel = guild?.channels.cache.get(poll.channelId);
    const message = await channel?.messages.fetch(poll.messageId).catch(() => null);
    if (!message) return;

    const { buildEmbed: be, buildButtons: bb } = require('./poll');
    const finalEmbed = be(poll.question, poll.options, poll.votes, message.embeds[0]?.footer?.text?.split(' • ')[0].replace('Poll by ', '') ?? 'Unknown', null, true);
    await message.edit({ embeds: [finalEmbed], components: [bb(poll.options, true)] });
}

module.exports.closePoll = closePoll;
