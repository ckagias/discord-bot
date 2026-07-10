import { connectDB } from "@/lib/db";
import Economy, { EconomyDoc } from "@/lib/models/Economy";
import SettingsCard from "@/components/SettingsCard";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-[var(--text)]",
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
          <table className={STYLES.table}>
            <thead className={STYLES.thead}>
              <tr>
                <th className={STYLES.th}>#</th>
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
                    <code className="rounded bg-[var(--bg-light)] px-1.5 py-0.5 text-xs">
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
        )}
      </SettingsCard>
    </>
  );
}
