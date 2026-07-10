import { connectDB } from "@/lib/db";
import { fetchGuildChannels, fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCard from "@/components/SettingsCard";
import SectionForm from "@/components/SectionForm";
import { ChannelField, RoleField, TextField, ToggleField } from "@/components/Field";
import { updateAntiRaidSettings } from "./actions";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-[var(--text)]",
  stack: "flex flex-col gap-8 max-w-xl",
  lockdownBadge: (locked: boolean) =>
    [
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      locked
        ? "bg-[var(--danger)]/10 text-[var(--danger)]"
        : "bg-[var(--bg-light)] text-[var(--text-muted)]",
    ].join(" "),
  lockdownRow: "flex items-center gap-3",
  lockdownLabel: "text-sm font-medium text-[var(--text)]",
  lockdownHint: "mt-1 text-sm text-[var(--text-muted)]",
};

const TEXT_CHANNEL_TYPE = 0;

type AntiRaidFields = Pick<
  GuildDoc,
  | "antiRaidEnabled"
  | "antiRaidQuarantineRoleId"
  | "antiRaidJoinThreshold"
  | "antiRaidJoinWindow"
  | "antiRaidAlertChannelId"
  | "antiRaidLocked"
  | "antiRaidLockedAt"
>;

export default async function AntiRaidPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [guildDoc, channels, roles] = await Promise.all([
    Guild.findOne({ guildId }).lean<GuildDoc>(),
    fetchGuildChannels(guildId),
    fetchGuildRoles(guildId),
  ]);

  // guildDoc may predate these fields — default field-by-field rather than relying on
  // Mongoose schema defaults, which only apply to documents created after the field was added.
  const guild: AntiRaidFields = {
    antiRaidEnabled: guildDoc?.antiRaidEnabled ?? false,
    antiRaidQuarantineRoleId: guildDoc?.antiRaidQuarantineRoleId ?? null,
    antiRaidJoinThreshold: guildDoc?.antiRaidJoinThreshold ?? 10,
    antiRaidJoinWindow: guildDoc?.antiRaidJoinWindow ?? 10,
    antiRaidAlertChannelId: guildDoc?.antiRaidAlertChannelId ?? null,
    antiRaidLocked: guildDoc?.antiRaidLocked ?? false,
    antiRaidLockedAt: guildDoc?.antiRaidLockedAt ?? null,
  };

  const textChannels = channels.filter((c) => c.type === TEXT_CHANNEL_TYPE);
  // Exclude @everyone and bot-managed roles from the quarantine role picker.
  const assignableRoles = roles.filter((r) => r.id !== guildId && !r.managed);

  const lockedAt = guild.antiRaidLocked && guild.antiRaidLockedAt
    ? new Date(guild.antiRaidLockedAt).toLocaleString()
    : null;

  return (
    <>
      <h1 className={STYLES.heading}>Anti-Raid</h1>
      <div className={STYLES.stack}>
        {/* Lockdown status — read-only, managed via /antiraid lock/unlock in Discord */}
        <SettingsCard
          title="Lockdown Status"
          description="Managed with /antiraid lock and /antiraid unlock in Discord."
        >
          <div className={STYLES.lockdownRow}>
            <span className={STYLES.lockdownLabel}>Current state</span>
            <span className={STYLES.lockdownBadge(guild.antiRaidLocked)}>
              {guild.antiRaidLocked ? "🔒 LOCKED" : "🔓 Normal"}
            </span>
          </div>
          {lockedAt && (
            <p className={STYLES.lockdownHint}>Lockdown started {lockedAt}</p>
          )}
        </SettingsCard>

        <SectionForm action={updateAntiRaidSettings.bind(null, guildId)}>
          <SettingsCard
            title="Auto-Detection"
            description="Automatically lock down when a join-rate spike is detected."
          >
            <ToggleField
              label="Enable automatic raid detection"
              description="Triggers a lockdown when the join threshold is exceeded within the configured window."
              name="antiRaidEnabled"
              defaultChecked={guild.antiRaidEnabled}
            />
          </SettingsCard>

          <SettingsCard
            title="Quarantine Setup"
            description="Configure the holding role and where lockdown alerts are sent."
          >
            <RoleField
              label="Quarantine role"
              description="Set up with /antiraid setrole so overwrites apply immediately."
              name="antiRaidQuarantineRoleId"
              defaultValue={guild.antiRaidQuarantineRoleId}
              roles={assignableRoles}
            />
            <ChannelField
              label="Alert channel"
              description="Falls back to the server log channel if not set."
              name="antiRaidAlertChannelId"
              defaultValue={guild.antiRaidAlertChannelId}
              channels={textChannels}
            />
          </SettingsCard>

          <SettingsCard
            title="Thresholds"
            description="How many joins within how many seconds triggers an automatic lockdown."
          >
            <TextField
              label="Join threshold"
              description="Number of new members joining within the window that triggers a lockdown."
              name="antiRaidJoinThreshold"
              defaultValue={String(guild.antiRaidJoinThreshold)}
            />
            <TextField
              label="Window (seconds)"
              description="The time window in seconds for counting joins. Default: 10."
              name="antiRaidJoinWindow"
              defaultValue={String(guild.antiRaidJoinWindow)}
            />
          </SettingsCard>
        </SectionForm>
      </div>
    </>
  );
}
