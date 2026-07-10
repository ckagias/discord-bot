import { connectDB } from "@/lib/db";
import Giveaway, { GiveawayDoc } from "@/lib/models/Giveaway";
import SettingsCard from "@/components/SettingsCard";
import { EndGiveawayButton, RerollGiveawayButton, DeleteGiveawayButton } from "./GiveawayActions";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-[var(--text)]",
  table: "text-sm",
  thead: "border-b border-[var(--border-muted)]",
  th: "pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
  thRight:
    "pb-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
  tr: "border-b border-[var(--border-muted)] last:border-0",
  td: "py-3 text-[var(--text)]",
  tdMuted: "py-3 text-[var(--text-muted)]",
  tdRight: "py-3 text-right text-[var(--text)]",
  badge: (ended: boolean) =>
    [
      "inline-block rounded px-1.5 py-0.5 text-xs font-semibold",
      ended
        ? "bg-[var(--bg-light)] text-[var(--text-muted)]"
        : "bg-[var(--warning)]/10 text-[var(--warning)]",
    ].join(" "),
  code: "rounded bg-[var(--bg-light)] px-1.5 py-0.5 text-xs font-mono",
  empty: "text-sm text-[var(--text-muted)]",
  actions: "flex items-center justify-end gap-1",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function jumpUrl(g: GiveawayDoc) {
  return `https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId}`;
}

function GiveawayTable({
  guildId,
  rows,
  showActions,
}: {
  guildId: string;
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

  return (
    <>
      <h1 className={STYLES.heading}>Giveaways</h1>
      <div className="max-w-xl">
        <SettingsCard title="Active" description="Click End to close one early.">
          {active.length === 0 ? (
            <p className={STYLES.empty}>No active giveaways.</p>
          ) : (
            <GiveawayTable guildId={guildId} rows={active} showActions="end" />
          )}
        </SettingsCard>
        <div className="mt-6">
          <SettingsCard
            title="Past Giveaways"
            description="Reroll picks new winners from the original entrants."
          >
            {ended.length === 0 ? (
              <p className={STYLES.empty}>No past giveaways.</p>
            ) : (
              <GiveawayTable guildId={guildId} rows={ended} showActions="reroll" />
            )}
          </SettingsCard>
        </div>
      </div>
    </>
  );
}
