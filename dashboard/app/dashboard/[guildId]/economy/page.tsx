import { connectDB } from "@/lib/db";
import { fetchGuildMemberName } from "@/lib/discord";
import Economy, { EconomyDoc } from "@/lib/models/Economy";
import SettingsCard from "@/components/SettingsCard";
import CopyOnClick from "@/components/CopyOnClick";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
  table: "w-full text-sm",
  thead: "border-b border-[var(--border-muted)]",
  th: "pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
  thRight: "pb-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
  tr: "border-b border-[var(--border-muted)] last:border-0",
  td: "py-3 text-[var(--text)]",
  tdRight: "py-3 text-right tabular-nums text-[var(--text)]",
  tdMuted: "py-3 text-[var(--text-muted)]",
  rank: "font-semibold text-[var(--text-muted)] w-8",
  medal: "text-base w-8",
  code: "rounded bg-[var(--bg-light)] px-1.5 py-0.5 text-xs",
  empty: "text-sm text-[var(--text-muted)]",
  // Tuned to line up with the right-rail "Server stats" panel's bottom edge; best-effort since that rail's content is conditional per guild.
  tableScroll: "max-h-[39.75rem] overflow-y-auto overflow-x-auto pr-3 -mr-3",
};

const MEDALS = ["🥇", "🥈", "🥉"];

function formatBalance(n: number) {
  return n.toLocaleString("en-US");
}

export default async function EconomyPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const top = await Economy.find({ guildId })
    .sort({ balance: -1 })
    .limit(20)
    .lean<EconomyDoc[]>();

  const uniqueUserIds = [...new Set(top.map((entry) => entry.userId))];
  const nameEntries = await Promise.all(
    uniqueUserIds.map(async (id) => [id, await fetchGuildMemberName(guildId, id)] as const)
  );
  const memberNames = new Map(nameEntries);

  return (
    <>
      <h1 className={STYLES.heading}>Economy Leaderboard</h1>
      <SettingsCard title="Richest Members" description="Top 20 by credit balance.">
        {top.length === 0 ? (
          <p className={STYLES.empty}>
            No one has any credits yet. Members earn credits by chatting, using{" "}
            <code>/daily</code>, or <code>/work</code>.
          </p>
        ) : (
          <div className={STYLES.tableScroll}>
            <table className={STYLES.table}>
              <thead className={STYLES.thead}>
                <tr>
                  <th className={STYLES.th}>#</th>
                  <th className={STYLES.th}>User</th>
                  <th className={STYLES.th}>User ID</th>
                  <th className={STYLES.th}>Streak</th>
                  <th className={STYLES.thRight}>Balance</th>
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
                      <CopyOnClick value={entry.userId} truncate={!!memberNames.get(entry.userId)} title={`Click to copy ID: ${entry.userId}`}>
                        {memberNames.get(entry.userId) ?? "Unknown user"}
                      </CopyOnClick>
                    </td>
                    <td className={STYLES.td}>
                      <code className={STYLES.code}>
                        {entry.userId}
                      </code>
                    </td>
                    <td className={STYLES.tdMuted}>
                      {entry.dailyStreak > 0 ? `🔥 ${entry.dailyStreak}d` : "—"}
                    </td>
                    <td className={STYLES.tdRight}>
                      💰 {formatBalance(entry.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsCard>
    </>
  );
}
