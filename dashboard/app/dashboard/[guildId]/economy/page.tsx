import { connectDB } from "@/lib/db";
import Economy, { EconomyDoc } from "@/lib/models/Economy";
import SettingsCard from "@/components/SettingsCard";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-black dark:text-zinc-50",
  table: "w-full text-sm",
  thead: "border-b border-zinc-200 dark:border-zinc-800",
  th: "pb-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  thRight: "pb-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  tr: "border-b border-zinc-100 last:border-0 dark:border-zinc-800/60",
  td: "py-3 text-black dark:text-zinc-100",
  tdRight: "py-3 text-right tabular-nums text-black dark:text-zinc-100",
  tdMuted: "py-3 text-zinc-500 dark:text-zinc-400",
  rank: "font-semibold text-zinc-400 dark:text-zinc-500 w-8",
  medal: "text-base w-8",
  empty: "text-sm text-zinc-500 dark:text-zinc-400",
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
      <SettingsCard
        title="Richest Members"
        description="Top 20 members by credit balance in this server. Updates live from the database."
      >
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
                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
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
