import Link from "next/link";
import { connectDB } from "@/lib/db";
import Case, { CaseDoc } from "@/lib/models/Case";
import SettingsCard from "@/components/SettingsCard";
import CaseSearch from "./CaseSearch";
import DeleteCaseButton from "./DeleteCaseButton";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-[var(--text)]",
  table: "text-sm",
  thead: "border-b border-[var(--border-muted)]",
  th: "pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
  thRight:
    "pb-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
  thSortable:
    "cursor-pointer select-none pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text)]",
  tr: "border-b border-[var(--border-muted)] last:border-0",
  td: "py-3 text-[var(--text)]",
  tdMuted: "py-3 text-[var(--text-muted)]",
  tdRight: "py-3 text-right text-[var(--text)]",
  badge: (type: string) => {
    const map: Record<string, string> = {
      warn: "bg-[var(--warning)]/10 text-[var(--warning)]",
      kick: "bg-[var(--warning)]/10 text-[var(--warning)]",
      ban: "bg-[var(--danger)]/10 text-[var(--danger)]",
      mute: "bg-[var(--secondary)]/10 text-[var(--secondary)]",
      timeout: "bg-[var(--info)]/10 text-[var(--info)]",
      timeout_remove: "bg-[var(--bg-light)] text-[var(--text-muted)]",
      unban: "bg-[var(--success)]/10 text-[var(--success)]",
      unmute: "bg-[var(--success)]/10 text-[var(--success)]",
    };
    return [
      "inline-block rounded px-1.5 py-0.5 text-xs font-semibold capitalize",
      map[type] ?? "bg-[var(--bg-light)] text-[var(--text-muted)]",
    ].join(" ");
  },
  code: "rounded bg-[var(--bg-light)] px-1.5 py-0.5 text-xs",
  empty: "text-sm text-[var(--text-muted)]",
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
      <div className="max-w-xl">
        <SettingsCard
          title="Cases"
          description="Every moderation action, searchable by user ID."
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
                        <span className="ml-1.5 text-xs text-[var(--text-muted)]">{c.duration}</span>
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
      </div>
    </>
  );
}
