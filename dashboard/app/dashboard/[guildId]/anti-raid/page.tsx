import { connectDB } from "@/lib/db";
import { fetchGuildChannels, fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCard from "@/components/SettingsCard";
import SectionForm from "@/components/SectionForm";
import { ChannelField, RoleField, TextField, ToggleField } from "@/components/Field";
import { updateAntiRaidSettings } from "./actions";
import LockdownActions from "./LockdownActions";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
  form: "flex flex-col gap-6",
  cross: "grid grid-cols-1 gap-6 lg:grid-cols-2",
  crossCard: "h-full rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-6 py-6 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
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
  ruleSummary: "text-sm text-[var(--text-muted)]",
  stepList: "flex flex-col gap-3",
  step: "flex items-start gap-3",
  stepNum:
    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-xs font-semibold text-[var(--primary)]",
  stepText: "text-sm text-[var(--text-muted)]",
  stepTextStrong: "font-medium text-[var(--text)]",
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
      <SectionForm
        action={updateAntiRaidSettings.bind(null, guildId)}
        className={STYLES.form}
        contentClassName={STYLES.cross}
      >
        <SettingsCard
          title="Auto-Detection"
          description="Automatically lock down when a join-rate spike is detected."
          className={STYLES.crossCard}
        >
          {/* Lockdown status — read-only, managed via /antiraid lock/unlock in Discord */}
          <div>
            <div className={STYLES.lockdownRow}>
              <span className={STYLES.lockdownLabel}>Current state</span>
              <span className={STYLES.lockdownBadge(guild.antiRaidLocked)}>
                {guild.antiRaidLocked ? "🔒 LOCKED" : "🔓 Normal"}
              </span>
            </div>
            <p className={STYLES.lockdownHint}>
              {lockedAt ? `Lockdown started ${lockedAt}` : "No lockdown is currently active."}
            </p>
          </div>
          <ToggleField
            label="Enable automatic raid detection"
            description="Triggers a lockdown when the join threshold is exceeded within the configured window."
            name="antiRaidEnabled"
            defaultChecked={guild.antiRaidEnabled}
          />
          <LockdownActions guildId={guildId} locked={guild.antiRaidLocked} />
          <p className={STYLES.ruleSummary}>
            Auto-locks after {guild.antiRaidJoinThreshold} joins within {guild.antiRaidJoinWindow}s.
          </p>
        </SettingsCard>

        <SettingsCard
          title="Quarantine Setup"
          description="Configure the holding role and where lockdown alerts are sent."
          className={STYLES.crossCard}
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
          title="How it works"
          description="The anti-raid flow, start to finish."
          className={STYLES.crossCard}
        >
          <ol className={STYLES.stepList}>
            <li className={STYLES.step}>
              <span className={STYLES.stepNum}>1</span>
              <span className={STYLES.stepText}>
                <span className={STYLES.stepTextStrong}>Detect:</span> When people join
                faster than your threshold allows, the bot locks the server on its own.
                This only happens while Auto-Detection is on.
              </span>
            </li>
            <li className={STYLES.step}>
              <span className={STYLES.stepNum}>2</span>
              <span className={STYLES.stepText}>
                <span className={STYLES.stepTextStrong}>Quarantine:</span> New joiners get
                the quarantine role, which hides every channel so they wait outside the
                server.
              </span>
            </li>
            <li className={STYLES.step}>
              <span className={STYLES.stepNum}>3</span>
              <span className={STYLES.stepText}>
                <span className={STYLES.stepTextStrong}>Alert:</span> The bot posts a
                notice in your alert channel, falling back to the server log channel
                when none is set.
              </span>
            </li>
            <li className={STYLES.step}>
              <span className={STYLES.stepNum}>4</span>
              <span className={STYLES.stepText}>
                <span className={STYLES.stepTextStrong}>Recover:</span> Once staff have
                had a look, run <code>/antiraid unlock</code> in Discord to reopen the
                server. You can also run <code>/antiraid lock</code> to trigger a
                lockdown yourself.
              </span>
            </li>
          </ol>
        </SettingsCard>

        <SettingsCard
          title="Thresholds"
          description="How many joins within how many seconds triggers an automatic lockdown."
          className={STYLES.crossCard}
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
    </>
  );
}
