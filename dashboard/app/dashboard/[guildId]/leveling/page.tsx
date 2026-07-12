import { connectDB } from "@/lib/db";
import { fetchGuildChannels, fetchGuildMemberName, fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import Level, { LevelDoc } from "@/lib/models/Level";
import SettingsCard from "@/components/SettingsCard";
import CopyOnClick from "@/components/CopyOnClick";
import LevelingSettingsForm from "./LevelingSettingsForm";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
  grid: "grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start",
  leftCol: "flex flex-col lg:h-[41.1rem]",
  leaderboardCard: "flex flex-col rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-6 py-6 lg:h-[41.1rem] shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  leaderboardBody: "mt-6 flex flex-1 min-h-0 flex-col gap-6",
  leaderboardEmpty: "flex flex-1 min-h-0 items-center justify-center",
  leaderboardScroll: "flex flex-1 min-h-0 flex-col justify-center overflow-y-auto overflow-x-auto",
  table: "w-full text-sm",
  thead: "border-b border-[var(--border-muted)]",
  theadSticky: "sticky top-0 border-b border-[var(--border-muted)] bg-[var(--bg)]",
  thRank: "w-10 px-2 pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] first:pl-0",
  th: "px-2 pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
  thRight: "px-2 pb-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] last:pr-0",
  tr: "border-b border-[var(--border-muted)] last:border-0",
  tdRank: "w-10 px-2 py-3 text-[var(--text)] first:pl-0",
  td: "px-2 py-3 text-[var(--text)]",
  tdRight: "px-2 py-3 text-right tabular-nums text-[var(--text)] last:pr-0",
  tdMuted: "px-2 py-3 text-[var(--text-muted)]",
  rank: "font-semibold text-[var(--text-muted)]",
  medal: "text-base",
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
    Level.find({ guildId, level: { $gte: 1 } }).sort({ level: -1, xp: -1 }).limit(20).lean<LevelDoc[]>(),
  ]);

  const textChannels = channels.filter((c) => c.type === TEXT_CHANNEL_TYPE);
  const roles = allRoles.filter((r) => r.id !== guildId && !r.managed);

  const uniqueUserIds = [...new Set(top.map((entry) => entry.userId))];
  const nameEntries = await Promise.all(
    uniqueUserIds.map(async (id) => [id, await fetchGuildMemberName(guildId, id)] as const)
  );
  const memberNames = new Map(nameEntries);

  const guild: Pick<GuildDoc, "levelingEnabled" | "levelUpChannelId" | "levelRoles"> = guildDoc ?? {
    levelingEnabled: false,
    levelUpChannelId: null,
    levelRoles: [],
  };

  return (
    <>
      <h1 className={STYLES.heading}>Leveling</h1>
      <div className={STYLES.grid}>
        <div className={STYLES.leftCol}>
          <LevelingSettingsForm
            guildId={guildId}
            levelingEnabled={guild.levelingEnabled}
            levelUpChannelId={guild.levelUpChannelId}
            textChannels={textChannels}
            initialLevelRoles={guild.levelRoles}
            roles={roles}
          />
        </div>
        <SettingsCard
          title="Leaderboard"
          description="Top 20 by level and XP."
          className={STYLES.leaderboardCard}
          bodyClassName={STYLES.leaderboardBody}
        >
          {top.length === 0 ? (
            <div className={STYLES.leaderboardEmpty}>
              <p className={STYLES.empty}>
                No one has earned XP yet. Members gain XP by chatting.
              </p>
            </div>
          ) : (
            <div className={STYLES.leaderboardScroll}>
              <table className={STYLES.table}>
                <thead className={STYLES.theadSticky}>
                  <tr>
                    <th className={STYLES.thRank}>#</th>
                    <th className={STYLES.th}>User</th>
                    <th className={STYLES.th}>Level</th>
                    <th className={STYLES.thRight}>XP</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((entry, i) => (
                    <tr key={entry.userId} className={STYLES.tr}>
                      <td className={STYLES.tdRank}>
                        <span className={i < 3 ? STYLES.medal : STYLES.rank}>
                          {i < 3 ? MEDALS[i] : `#${i + 1}`}
                        </span>
                      </td>
                      <td className={STYLES.td}>
                        <CopyOnClick value={entry.userId} truncate={!!memberNames.get(entry.userId)} title={`Click to copy ID: ${entry.userId}`}>
                          {memberNames.get(entry.userId) ?? "Unknown user"}
                        </CopyOnClick>
                      </td>
                      <td className={STYLES.tdMuted}>⭐ {entry.level}</td>
                      <td className={STYLES.tdRight}>{formatXp(entry.xp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SettingsCard>
      </div>
    </>
  );
}
