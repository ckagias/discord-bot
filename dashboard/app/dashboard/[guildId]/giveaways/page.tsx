import { connectDB } from "@/lib/db";
import Giveaway, { GiveawayDoc } from "@/lib/models/Giveaway";
import SettingsCard from "@/components/SettingsCard";
import { EndGiveawayButton, RerollGiveawayButton, DeleteGiveawayButton } from "./GiveawayActions";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-black dark:text-zinc-50",
  table: "w-full text-sm",
  thead: "border-b border-zinc-200 dark:border-zinc-800",
  th: "pb-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  thRight:
    "pb-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  tr: "border-b border-zinc-100 last:border-0 dark:border-zinc-800/60",
  td: "py-3 text-black dark:text-zinc-100",
  tdMuted: "py-3 text-zinc-500 dark:text-zinc-400",
  tdRight: "py-3 text-right text-black dark:text-zinc-100",
  badge: (ended: boolean) =>
    [
      "inline-block rounded px-1.5 py-0.5 text-xs font-semibold",
      ended
        ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    ].join(" "),
  code: "rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono dark:bg-zinc-800",
  empty: "text-sm text-zinc-500 dark:text-zinc-400",
  actions: "flex items-center justify-end gap-1",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function GiveawaysPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const giveaways = await Giveaway.find({ guildId })
    .sort({ endsAt: -1 })
    .limit(50)
    .lean<GiveawayDoc[]>();

  const active = giveaways.filter((g) => !g.ended);
  const ended = giveaways.filter((g) => g.ended);

  function jumpUrl(g: GiveawayDoc) {
    return `https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId}`;
  }

  function GiveawayTable({
    rows,
    showActions,
  }: {
    rows: GiveawayDoc[];
    showActions: "end" | "reroll" | false;
  }) {
    if (rows.length === 0) return null;
    return (
      <table className={STYLES.table}>
        <thead className={STYLES.thead}>
          <tr>
            <th className={STYLES.th}>Prize</th>
            <th className={STYLES.th}>Entries</th>
            <th className={STYLES.th}>Winners</th>
            <th className={STYLES.th}>Host</th>
            <th className={STYLES.thRight}>
              {showActions === "end" ? "Ends" : "Ended"}
            </th>
            {showActions && <th className={STYLES.th} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.messageId} className={STYLES.tr}>
              <td className={STYLES.td}>
                <a
                  href={jumpUrl(g)}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {g.prize}
                </a>
              </td>
              <td className={STYLES.tdMuted}>{g.entrants.length}</td>
              <td className={STYLES.tdMuted}>
                {g.ended
                  ? g.winners.length > 0
                    ? g.winners.map((id) => (
                        <span key={id} className={STYLES.code}>
                          {id}
                        </span>
                      ))
                    : "—"
                  : g.winnerCount}
              </td>
              <td className={STYLES.tdMuted}>
                <span className={STYLES.code}>{g.hostId}</span>
              </td>
              <td className={STYLES.tdRight}>{formatDate(g.endsAt)}</td>
              {showActions && (
                <td className="py-3 pl-3">
                  <div className={STYLES.actions}>
                    {showActions === "end" && (
                      <EndGiveawayButton guildId={guildId} messageId={g.messageId} />
                    )}
                    {showActions === "reroll" && (
                      <>
                        <RerollGiveawayButton guildId={guildId} messageId={g.messageId} />
                        <DeleteGiveawayButton guildId={guildId} messageId={g.messageId} />
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <>
      <h1 className={STYLES.heading}>Giveaways</h1>
      <SettingsCard
        title="Active"
        description="Giveaways currently running in this server. Click End to close one early."
      >
        {active.length === 0 ? (
          <p className={STYLES.empty}>No active giveaways.</p>
        ) : (
          <GiveawayTable rows={active} showActions="end" />
        )}
      </SettingsCard>
      <div className="mt-6">
        <SettingsCard
          title="Past Giveaways"
          description="Ended giveaways. Use Reroll to pick new winners from the original entrant pool."
        >
          {ended.length === 0 ? (
            <p className={STYLES.empty}>No past giveaways.</p>
          ) : (
            <GiveawayTable rows={ended} showActions="reroll" />
          )}
        </SettingsCard>
      </div>
    </>
  );
}
