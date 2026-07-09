import { connectDB } from "@/lib/db";
import Suggestion, { SuggestionDoc } from "@/lib/models/Suggestion";
import SettingsCard from "@/components/SettingsCard";
import { SuggestionReviewActions, DeleteSuggestionButton } from "./SuggestionActions";

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
  badge: (status: SuggestionDoc["status"]) => {
    const map: Record<SuggestionDoc["status"], string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      implemented: "bg-[#5865F2]/10 text-[#5865F2] dark:bg-[#5865F2]/15",
    };
    return ["inline-block rounded px-1.5 py-0.5 text-xs font-semibold capitalize", map[status]].join(" ");
  },
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

function jumpUrl(s: SuggestionDoc) {
  return `https://discord.com/channels/${s.guildId}/${s.channelId}/${s.messageId}`;
}

function SuggestionTable({
  guildId,
  rows,
  reviewable,
}: {
  guildId: string;
  rows: SuggestionDoc[];
  reviewable: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <table className={STYLES.table}>
      <thead className={STYLES.thead}>
        <tr>
          <th className={STYLES.th}>Suggestion</th>
          <th className={STYLES.th}>Author</th>
          <th className={STYLES.th}>Votes</th>
          <th className={STYLES.th}>Status</th>
          <th className={STYLES.thRight}>Submitted</th>
          <th className={STYLES.th} />
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.messageId} className={STYLES.tr}>
            <td className={STYLES.td}>
              <a href={jumpUrl(s)} target="_blank" rel="noreferrer" className="hover:underline">
                {s.content.length > 60 ? `${s.content.slice(0, 60)}…` : s.content}
              </a>
            </td>
            <td className={STYLES.tdMuted}>
              <span className={STYLES.code}>{s.authorId}</span>
            </td>
            <td className={STYLES.tdMuted}>
              👍 {s.upvotes.length} 👎 {s.downvotes.length}
            </td>
            <td className={STYLES.td}>
              <span className={STYLES.badge(s.status)}>{s.status}</span>
            </td>
            <td className={STYLES.tdRight}>{formatDate(s.createdAt)}</td>
            <td className="py-3 pl-3">
              <div className={STYLES.actions}>
                {reviewable ? (
                  <SuggestionReviewActions guildId={guildId} messageId={s.messageId} />
                ) : (
                  <DeleteSuggestionButton guildId={guildId} messageId={s.messageId} />
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function SuggestionsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const suggestions = await Suggestion.find({ guildId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean<SuggestionDoc[]>();

  const pending = suggestions.filter((s) => s.status === "pending");
  const resolved = suggestions.filter((s) => s.status !== "pending");

  return (
    <>
      <h1 className={STYLES.heading}>Suggestions</h1>
      <SettingsCard
        title="Pending"
        description="Suggestions awaiting review. Approve, deny, or mark implemented."
      >
        {pending.length === 0 ? (
          <p className={STYLES.empty}>No pending suggestions.</p>
        ) : (
          <SuggestionTable guildId={guildId} rows={pending} reviewable />
        )}
      </SettingsCard>
      <div className="mt-6">
        <SettingsCard title="Resolved" description="Suggestions that have already been reviewed.">
          {resolved.length === 0 ? (
            <p className={STYLES.empty}>No resolved suggestions yet.</p>
          ) : (
            <SuggestionTable guildId={guildId} rows={resolved} reviewable={false} />
          )}
        </SettingsCard>
      </div>
    </>
  );
}
