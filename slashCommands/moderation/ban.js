const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const PunishmentSchema = require('../../models/PunishmentSchema');
const { parseDuration, formatDuration, schedulePunishment } = require('../../utils/punishments');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration of the ban (e.g. 7d, 24h). Omit for permanent.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('delete_messages')
                .setDescription('How many days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    permissions: PermissionFlagsBits.BanMembers,

    async execute(interaction) {
        const target = interaction.options.getMember('user');
        const durStr = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        const deleteDays = interaction.options.getInteger('delete_messages') ?? 0;

        if (!target) {
            return interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });
        }

        if (interaction.member.roles.highest.position <= target.roles.highest.position) {
            return interaction.reply({ content: 'You cannot ban someone with an equal or higher role.', flags: MessageFlags.Ephemeral });
        }

        if (!target.bannable) {
            return interaction.reply({ content: 'I cannot ban that user (check my role position).', flags: MessageFlags.Ephemeral });
        }

        let durationMs = null;
        if (durStr) {
            durationMs = parseDuration(durStr);
            if (!durationMs) {
                return interaction.reply({ content: 'Invalid duration format. Use a number followed by `s`, `m`, `h`, or `d` (e.g. `7d`).', flags: MessageFlags.Ephemeral });
            }
        }

        await target.send(
            durationMs
                ? `You have been temporarily banned from **${interaction.guild.name}** for **${formatDuration(durationMs)}**. Reason: ${reason}`
                : `You have been permanently banned from **${interaction.guild.name}**. Reason: ${reason}`
        ).catch(() => {});

        await target.ban({ reason, deleteMessageSeconds: deleteDays * 86400 });

        if (durationMs) {
            const expiresAt = new Date(Date.now() + durationMs);
            const punishment = await PunishmentSchema.create({
                type: 'ban',
                guildId: interaction.guild.id,
                userId: target.id,
                expiresAt,
            });
            schedulePunishment(interaction.client, punishment);
            return interaction.reply({
                content: `Banned **${target.user.tag}** for **${formatDuration(durationMs)}** for \`${reason}\``,
            });
        }

        return interaction.reply({ content: `Banned **${target.user.tag}** for \`${reason}\`` });
    },
};
