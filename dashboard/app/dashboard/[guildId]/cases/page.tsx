import Link from "next/link";
import { connectDB } from "@/lib/db";
import Case, { CaseDoc } from "@/lib/models/Case";
import SettingsCard from "@/components/SettingsCard";
import CaseSearch from "./CaseSearch";
import DeleteCaseButton from "./DeleteCaseButton";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-black dark:text-zinc-50",
  table: "w-full text-sm",
  thead: "border-b border-zinc-200 dark:border-zinc-800",
  th: "pb-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  thRight:
    "pb-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  thSortable:
    "cursor-pointer select-none pb-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50",
  tr: "border-b border-zinc-100 last:border-0 dark:border-zinc-800/60",
  td: "py-3 text-black dark:text-zinc-100",
  tdMuted: "py-3 text-zinc-500 dark:text-zinc-400",
  tdRight: "py-3 text-right text-black dark:text-zinc-100",
  badge: (type: string) => {
    const map: Record<string, string> = {
      warn: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      kick: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      ban: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      mute: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      timeout: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      timeout_remove: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      unban: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      unmute: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    };
    return [
      "inline-block rounded px-1.5 py-0.5 text-xs font-semibold capitalize",
      map[type] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    ].join(" ");
  },
  code: "rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800",
  empty: "text-sm text-zinc-500 dark:text-zinc-400",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function CasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ userId?: string; order?: string }>;
}) {
  const { guildId } = await params;
  const { userId, order } = await searchParams;
  const sortAsc = order === "asc";
  await connectDB();

  const query: Record<string, unknown> = { guildId };
  if (userId?.trim()) query.userId = userId.trim();

  const cases = await Case.find(query)
    .sort({ caseId: sortAsc ? 1 : -1 })
    .limit(50)
    .lean<CaseDoc[]>();

  function toggleOrderHref() {
    const params = new URLSearchParams();
    if (userId?.trim()) params.set("userId", userId.trim());
    params.set("order", sortAsc ? "desc" : "asc");
    return `?${params.toString()}`;
  }

  return (
    <>
      <h1 className={STYLES.heading}>Mod Case Log</h1>
      <SettingsCard
        title="Cases"
        description="All moderation actions logged in this server. Filter by user ID to view a member's history."
      >
        <CaseSearch defaultValue={userId ?? ""} order={order ?? "desc"} />
        {cases.length === 0 ? (
          <p className={STYLES.empty}>
            {userId ? `No cases found for user ID ${userId}.` : "No cases logged yet."}
          </p>
        ) : (
          <table className={STYLES.table}>
            <thead className={STYLES.thead}>
              <tr>
                <th className={STYLES.thSortable}>
                  <Link href={toggleOrderHref()}>
                    # {sortAsc ? "↑" : "↓"}
                  </Link>
                </th>
                <th className={STYLES.th}>Type</th>
                <th className={STYLES.th}>User</th>
                <th className={STYLES.th}>Moderator</th>
                <th className={STYLES.th}>Reason</th>
                <th className={STYLES.thRight}>Date</th>
                <th className={STYLES.th}></th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.caseId} className={STYLES.tr}>
                  <td className={STYLES.tdMuted}>#{c.caseId}</td>
                  <td className={STYLES.td}>
                    <span className={STYLES.badge(c.type)}>
                      {c.type.replace("_", " ")}
                    </span>
                    {c.duration && (
                      <span className="ml-1.5 text-xs text-zinc-400">{c.duration}</span>
                    )}
                  </td>
                  <td className={STYLES.td}>
                    <code className={STYLES.code}>{c.userId}</code>
                  </td>
                  <td className={STYLES.tdMuted}>
                    <code className={STYLES.code}>{c.moderatorId}</code>
                  </td>
                  <td className={STYLES.td}>{c.reason}</td>
                  <td className={STYLES.tdRight}>{formatDate(c.createdAt)}</td>
                  <td className="py-3 pl-3 text-right">
                    <DeleteCaseButton guildId={guildId} caseId={c.caseId} />
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
