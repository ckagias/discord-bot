import { connectDB } from "@/lib/db";
import { fetchGuildChannels, fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import Level, { LevelDoc } from "@/lib/models/Level";
import SettingsCard from "@/components/SettingsCard";
import SectionForm from "@/components/SectionForm";
import { ChannelField, ToggleField } from "@/components/Field";
import { updateLevelingSettings } from "./actions";
import LevelRolesForm from "./LevelRolesForm";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-[var(--text)]",
  stack: "flex flex-col gap-8 max-w-xl",
  table: "text-sm",
  thead: "border-b border-[var(--border-muted)]",
  th: "pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
  thRight: "pb-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
  tr: "border-b border-[var(--border-muted)] last:border-0",
  td: "py-3 text-[var(--text)]",
  tdRight: "py-3 text-right tabular-nums text-[var(--text)]",
  tdMuted: "py-3 text-[var(--text-muted)]",
  rank: "font-semibold text-[var(--text-muted)] w-8",
  medal: "text-base w-8",
  empty: "text-sm text-[var(--text-muted)]",
};

const MEDALS = ["🥇", "🥈", "🥉"];
const TEXT_CHANNEL_TYPE = 0;

function formatXp(n: number) {
  return n.toLocaleString("en-US");
}

export default async function LevelingPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [guildDoc, channels, allRoles, top] = await Promise.all([
    Guild.findOne({ guildId }).lean<GuildDoc>(),
    fetchGuildChannels(guildId),
    fetchGuildRoles(guildId),
    Level.find({ guildId }).sort({ level: -1, xp: -1 }).limit(20).lean<LevelDoc[]>(),
  ]);

  const textChannels = channels.filter((c) => c.type === TEXT_CHANNEL_TYPE);
  const roles = allRoles.filter((r) => r.id !== guildId && !r.managed);

  const guild: Pick<GuildDoc, "levelingEnabled" | "levelUpChannelId" | "levelRoles"> = guildDoc ?? {
    levelingEnabled: false,
    levelUpChannelId: null,
    levelRoles: [],
  };

  return (
    <>
      <h1 className={STYLES.heading}>Leveling</h1>
      <div className={STYLES.stack}>
        <SectionForm action={updateLevelingSettings.bind(null, guildId)}>
          <SettingsCard title="Settings" description="Configure the XP leveling system for this server.">
            <ToggleField
              label="Enable leveling"
              name="levelingEnabled"
              defaultChecked={guild.levelingEnabled}
            />
            <ChannelField
              label="Level-up channel"
              description="Where level-up announcements are posted. Leave as None to post in the channel where the member chatted."
              name="levelUpChannelId"
              defaultValue={guild.levelUpChannelId}
              channels={textChannels}
            />
          </SettingsCard>
        </SectionForm>
        <LevelRolesForm guildId={guildId} initial={guild.levelRoles} roles={roles} />
        <SettingsCard title="Leaderboard" description="Top 20 by level and XP.">
          {top.length === 0 ? (
            <p className={STYLES.empty}>
              No one has earned XP yet. Members gain XP by chatting.
            </p>
          ) : (
            <table className={STYLES.table}>
              <thead className={STYLES.thead}>
                <tr>
                  <th className={STYLES.th}>#</th>
                  <th className={STYLES.th}>User ID</th>
                  <th className={STYLES.th}>Level</th>
                  <th className={STYLES.thRight}>XP</th>
                </tr>
              </thead>
              <tbody>
                {top.map((entry, i) => (
                  <tr key={entry.userId} className={STYLES.tr}>
                    <td className={STYLES.td}>
                      <span className={i < 3 ? STYLES.medal : STYLES.rank}>
                        {i < 3 ? MEDALS[i] : `#${i + 1}`}
                      </span>
                    </td>
                    <td className={STYLES.td}>
                      <code className="rounded bg-[var(--bg-light)] px-1.5 py-0.5 text-xs">
                        {entry.userId}
                      </code>
                    </td>
                    <td className={STYLES.tdMuted}>⭐ {entry.level}</td>
                    <td className={STYLES.tdRight}>{formatXp(entry.xp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SettingsCard>
      </div>
    </>
  );
}
