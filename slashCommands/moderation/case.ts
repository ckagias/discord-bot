import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
const CaseSchema = require('../../models/CaseSchema');

const TYPE_LABELS: Record<string, string> = {
    warn: '⚠️ Warn',
    kick: '👢 Kick',
    ban: '🔨 Ban',
    mute: '🔇 Mute',
    timeout: '⏱️ Timeout',
    timeout_remove: '✅ Timeout Removed',
    unban: '✅ Unban',
    unmute: '✅ Unmute',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('case')
        .setDescription('Look up a moderation case.')
        .addSubcommand(sub =>
            sub.setName('lookup')
                .setDescription('View a specific case by ID.')
                .addIntegerOption(opt =>
                    opt.setName('id')
                        .setDescription('The case ID')
                        .setRequired(true)
                        .setMinValue(1))
        )
        .addSubcommand(sub =>
            sub.setName('history')
                .setDescription("View a user's case history.")
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user to look up')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a case by ID.')
                .addIntegerOption(opt =>
                    opt.setName('id')
                        .setDescription('The case ID to delete')
                        .setRequired(true)
                        .setMinValue(1))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    permissions: PermissionFlagsBits.ModerateMembers,

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'lookup') {
            const caseId = interaction.options.getInteger('id');
            const modCase = await CaseSchema.findOne({ guildId: interaction.guild.id, caseId });

            if (!modCase) {
                return interaction.reply({ content: `No case #${caseId} found in this server.`, flags: MessageFlags.Ephemeral });
            }

            const embed = new EmbedBuilder()
                .setTitle(`Case #${modCase.caseId} — ${TYPE_LABELS[modCase.type] ?? modCase.type}`)
                .addFields(
                    { name: 'User', value: `<@${modCase.userId}> (\`${modCase.userId}\`)`, inline: true },
                    { name: 'Moderator', value: `<@${modCase.moderatorId}>`, inline: true },
                    { name: 'Reason', value: modCase.reason },
                )
                .setTimestamp(modCase.createdAt)
                .setColor(0x5865f2);

            if (modCase.duration) embed.addFields({ name: 'Duration', value: modCase.duration, inline: true });

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'history') {
            const target = interaction.options.getUser('user');
            const cases = await CaseSchema.find({ guildId: interaction.guild.id, userId: target.id }).sort({ caseId: -1 }).limit(10).lean();

            if (!cases.length) {
                return interaction.reply({ content: `No cases found for **${target.tag}**.`, flags: MessageFlags.Ephemeral });
            }

            const lines = cases.map((c: any) => {
                const label = TYPE_LABELS[c.type] ?? c.type;
                const ts = Math.floor(new Date(c.createdAt).getTime() / 1000);
                return `**#${c.caseId}** ${label} — <t:${ts}:d> — ${c.reason}`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`Case history for ${target.tag}`)
                .setDescription(lines.join('\n'))
                .setColor(0x5865f2)
                .setFooter({ text: `Showing up to 10 most recent cases` });

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'delete') {
            const caseId = interaction.options.getInteger('id');
            const deleted = await CaseSchema.findOneAndDelete({ guildId: interaction.guild.id, caseId });

            if (!deleted) {
                return interaction.reply({ content: `No case #${caseId} found in this server.`, flags: MessageFlags.Ephemeral });
            }

            return interaction.reply({ content: `Deleted case #${caseId} (${TYPE_LABELS[deleted.type] ?? deleted.type} on <@${deleted.userId}>).` });
        }
    },
};
