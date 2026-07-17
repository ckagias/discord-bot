import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
const { getGuildConfig, updateGuildConfig } = require('../../utils/guildConfig');
const { startLockdown, endLockdown, ensureQuarantineOverwrites } = require('../../utils/antiRaid');
const { randomColor } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Configure and control the anti-raid system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('setrole')
                .setDescription('Set the quarantine role assigned to new members during a lockdown.')
                .addRoleOption(o =>
                    o.setName('role')
                        .setDescription('The holding/quarantine role.')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('lock')
                .setDescription('Manually activate a raid lockdown for this server.'))
        .addSubcommand(sub =>
            sub.setName('unlock')
                .setDescription('Lift the active raid lockdown. Quarantined members remain held.'))
        .addSubcommand(sub =>
            sub.setName('release')
                .setDescription('Remove the quarantine role from a single member (false-positive recovery).')
                .addUserOption(o =>
                    o.setName('member')
                        .setDescription('The member to release from quarantine.')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('config')
                .setDescription('Configure auto-detection thresholds and toggle automatic lockdowns.')
                .addIntegerOption(o =>
                    o.setName('threshold')
                        .setDescription('Number of joins that triggers auto-lockdown.')
                        .setMinValue(2)
                        .setMaxValue(100)
                        .setRequired(false))
                .addIntegerOption(o =>
                    o.setName('window')
                        .setDescription('Time window in seconds for the join threshold.')
                        .setMinValue(3)
                        .setMaxValue(300)
                        .setRequired(false))
                .addBooleanOption(o =>
                    o.setName('enabled')
                        .setDescription('Enable or disable automatic raid detection.')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Show the current anti-raid configuration and lockdown state.')),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { guild } = interaction;
        const sub = interaction.options.getSubcommand();
        const guildData = await getGuildConfig(guild.id);

        // ── setrole ──────────────────────────────────────────────────────────────
        if (sub === 'setrole') {
            const role = interaction.options.getRole('role');

            if (role.managed) {
                return interaction.editReply({ content: 'Bot-managed roles cannot be used as the quarantine role.' });
            }
            if (role.id === guild.id) {
                return interaction.editReply({ content: 'The @everyone role cannot be used as the quarantine role.' });
            }
            if (guild.members.me.roles.highest.position <= role.position) {
                return interaction.editReply({
                    content: `I can't assign ${role} — it's higher than or equal to my highest role.`,
                });
            }

            await updateGuildConfig(guild.id, { antiRaidQuarantineRoleId: role.id });

            // Apply channel overwrites immediately so the role is ready before any lockdown.
            await ensureQuarantineOverwrites(guild, role);

            return interaction.editReply({
                content:
                    `Quarantine role set to ${role}. Channel overwrites have been applied — the role is locked out of all channels.\n` +
                    `Use \`/antiraid lock\` to activate a manual lockdown, or configure auto-detection with \`/antiraid config\`.`,
            });
        }

        // ── lock ─────────────────────────────────────────────────────────────────
        if (sub === 'lock') {
            if (!guildData?.antiRaidQuarantineRoleId) {
                return interaction.editReply({
                    content: 'No quarantine role is configured. Run `/antiraid setrole` first.',
                });
            }
            if (guildData?.antiRaidLocked) {
                return interaction.editReply({ content: 'A lockdown is already active.' });
            }

            await startLockdown(guild, guildData, { auto: false, triggeredBy: interaction.user });
            return interaction.editReply({ content: '🔒 Lockdown activated. New members will be quarantined until you run `/antiraid unlock`.' });
        }

        // ── unlock ───────────────────────────────────────────────────────────────
        if (sub === 'unlock') {
            if (!guildData?.antiRaidLocked) {
                return interaction.editReply({ content: 'There is no active lockdown.' });
            }

            const { released } = await endLockdown(guild, guildData, { by: interaction.user });
            const count = released?.length ?? 0;
            return interaction.editReply({
                content:
                    `🔓 Lockdown lifted. New members will join normally again.\n` +
                    (count > 0
                        ? `**${count} quarantined member${count !== 1 ? 's' : ''} released.** A full list was posted to the alert channel.`
                        : 'No members were quarantined during the lockdown.'),
            });
        }

        // ── release ──────────────────────────────────────────────────────────────
        if (sub === 'release') {
            if (!guildData?.antiRaidQuarantineRoleId) {
                return interaction.editReply({ content: 'No quarantine role is configured.' });
            }

            const user = interaction.options.getUser('member');
            const member = await guild.members.fetch(user.id).catch(() => null);

            if (!member) {
                return interaction.editReply({ content: 'That user is not in this server.' });
            }

            const role = guild.roles.cache.get(guildData.antiRaidQuarantineRoleId);
            if (!role) {
                return interaction.editReply({ content: 'The configured quarantine role no longer exists.' });
            }

            if (!member.roles.cache.has(role.id)) {
                return interaction.editReply({ content: `${member} doesn't have the quarantine role.` });
            }

            await member.roles.remove(role, `Anti-raid: released by ${interaction.user.tag}`);
            return interaction.editReply({ content: `✅ Removed quarantine role from ${member}. They can now access the server normally.` });
        }

        // ── config ───────────────────────────────────────────────────────────────
        if (sub === 'config') {
            const threshold = interaction.options.getInteger('threshold');
            const window = interaction.options.getInteger('window');
            const enabled = interaction.options.getBoolean('enabled');

            if (threshold === null && window === null && enabled === null) {
                return interaction.editReply({ content: 'Provide at least one of: `threshold`, `window`, or `enabled`.' });
            }

            const updates: Record<string, unknown> = {};
            if (threshold !== null) updates.antiRaidJoinThreshold = threshold;
            if (window !== null) updates.antiRaidJoinWindow = window;
            if (enabled !== null) updates.antiRaidEnabled = enabled;

            await updateGuildConfig(guild.id, updates);

            const parts = [];
            if (threshold !== null) parts.push(`threshold → **${threshold} joins**`);
            if (window !== null) parts.push(`window → **${window}s**`);
            if (enabled !== null) parts.push(`auto-detection → **${enabled ? 'enabled' : 'disabled'}**`);

            return interaction.editReply({ content: `✅ Anti-raid config updated: ${parts.join(', ')}.` });
        }

        // ── status ───────────────────────────────────────────────────────────────
        if (sub === 'status') {
            const quarantineRole = guildData?.antiRaidQuarantineRoleId
                ? guild.roles.cache.get(guildData.antiRaidQuarantineRoleId)
                : null;

            const alertChannel = guildData?.antiRaidAlertChannelId
                ? guild.channels.cache.get(guildData.antiRaidAlertChannelId)
                : null;

            const lockdownLine = guildData?.antiRaidLocked
                ? `🔒 **ACTIVE** — started <t:${Math.floor(new Date(guildData.antiRaidLockedAt).getTime() / 1000)}:R>`
                : '🔓 Not active';

            const embed = new EmbedBuilder()
                .setColor(randomColor())
                .setTitle('Anti-Raid Status')
                .addFields(
                    { name: 'Lockdown', value: lockdownLine, inline: false },
                    { name: 'Auto-detection', value: guildData?.antiRaidEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Quarantine role', value: quarantineRole ? `${quarantineRole}` : '*Not set*', inline: true },
                    { name: 'Alert channel', value: alertChannel ? `${alertChannel}` : '*Falls back to log channel*', inline: true },
                    {
                        name: 'Trigger threshold',
                        value: `${guildData?.antiRaidJoinThreshold ?? 10} joins in ${guildData?.antiRaidJoinWindow ?? 10}s`,
                        inline: false,
                    }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }
    },
};
