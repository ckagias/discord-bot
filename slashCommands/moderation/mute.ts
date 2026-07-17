import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction, GuildMember } from 'discord.js';
const { getGuildConfig } = require('../../utils/guildConfig');
const PunishmentSchema = require('../../models/PunishmentSchema');
const { parseDuration, schedulePunishment } = require('../../utils/punishments');
const { formatDuration } = require('../../utils/duration');
const { createCase } = require('../../utils/cases');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a member by assigning the mute role.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration of the mute (e.g. 10m, 2h, 1d). Omit for permanent.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    permissions: PermissionFlagsBits.ModerateMembers,

    async execute(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getMember('user') as GuildMember | null;
        const durStr = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        if (!target) {
            return interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });
        }

        if ((interaction.member as any).roles.highest.position <= target.roles.highest.position) {
            return interaction.reply({ content: 'You cannot mute someone with an equal or higher role.', flags: MessageFlags.Ephemeral });
        }

        const guildData = await getGuildConfig(interaction.guild.id);

        if (!guildData?.muteRoleId) {
            return interaction.reply({ content: 'No mute role set. Use `/setmuterole` first.', flags: MessageFlags.Ephemeral });
        }

        const muteRole = interaction.guild.roles.cache.get(guildData.muteRoleId);

        if (!muteRole) {
            return interaction.reply({ content: 'The configured mute role no longer exists. Use `/setmuterole` to set a new one.', flags: MessageFlags.Ephemeral });
        }

        if (target.roles.cache.has(muteRole.id)) {
            return interaction.reply({ content: 'That user is already muted.', flags: MessageFlags.Ephemeral });
        }

        let durationMs = null;
        if (durStr) {
            durationMs = parseDuration(durStr);
            if (!durationMs) {
                return interaction.reply({ content: 'Invalid duration format. Use a number followed by `s`, `m`, `h`, or `d` (e.g. `30m`).', flags: MessageFlags.Ephemeral });
            }
        }

        await interaction.deferReply();

        // Skip channels that already have an overwrite for this role, to avoid hammering the API on every mute.
        const textChannels = interaction.guild.channels.cache.filter(c => c.isTextBased() && !(c as any).permissionOverwrites.cache.has(muteRole.id));
        const voiceChannels = interaction.guild.channels.cache.filter(c => c.isVoiceBased() && !(c as any).permissionOverwrites.cache.has(muteRole.id));

        if (textChannels.size || voiceChannels.size) {
            await Promise.allSettled([
                ...textChannels.map(c => (c as any).permissionOverwrites.edit(muteRole, {
                    SendMessages: false,
                    SendMessagesInThreads: false,
                    AddReactions: false,
                })),
                ...voiceChannels.map(c => (c as any).permissionOverwrites.edit(muteRole, {
                    Speak: false,
                    Connect: false,
                })),
            ]);
        }

        await target.roles.add(muteRole, reason);

        if (durationMs) {
            const expiresAt = new Date(Date.now() + durationMs);
            const durationLabel = formatDuration(durationMs);
            const [punishment, modCase] = await Promise.all([
                PunishmentSchema.create({ type: 'mute', guildId: interaction.guild.id, userId: target.id, expiresAt, muteRoleId: muteRole.id }),
                createCase({ guildId: interaction.guild.id, type: 'mute', userId: target.id, moderatorId: interaction.user.id, reason, duration: durationLabel }),
            ]);
            schedulePunishment(interaction.client, punishment);
            return interaction.editReply({
                content: `Muted **${target.user.tag}** for **${durationLabel}** for \`${reason}\` | Case #${modCase.caseId}`,
            });
        }

        const modCase = await createCase({ guildId: interaction.guild.id, type: 'mute', userId: target.id, moderatorId: interaction.user.id, reason });
        return interaction.editReply({ content: `Muted **${target.user.tag}** for \`${reason}\` | Case #${modCase.caseId}` });
    },
};
