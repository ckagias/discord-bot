import Link from "next/link";
import { connectDB } from "@/lib/db";
import { fetchGuildMemberName } from "@/lib/discord";
import Warn, { WarnDoc } from "@/lib/models/Warn";
import Case, { CaseDoc } from "@/lib/models/Case";
import SettingsCard from "@/components/SettingsCard";
import CopyOnClick from "@/components/CopyOnClick";
import WarnSearch from "./WarnSearch";
import DeleteWarnButton from "./DeleteWarnButton";
import CaseSearch from "../cases/CaseSearch";
import DeleteCaseButton from "../cases/DeleteCaseButton";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
  // Each card sizes to its own content instead of a forced 50/50 split — Case Log has more columns
  // (# and Type) than Warnings, so a fixed grid-cols-2 squeezed Warnings to make room for it.
  grid: "flex w-full flex-col gap-6 lg:flex-row lg:items-start",
  warningsCard: "rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-6 py-6 lg:min-w-0 lg:basis-0 lg:grow shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  casesCard: "rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-6 py-6 lg:min-w-0 lg:basis-0 lg:grow-[1.4] shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  tableScroll: "overflow-x-auto",
  table: "w-full text-sm",
  thead: "border-b border-[var(--border-muted)]",
  th: "px-2 pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] first:pl-0",
  thSortable:
    "px-2 cursor-pointer select-none pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text)] first:pl-0",
  thSortableRight:
    "px-2 cursor-pointer select-none pb-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text)] last:pr-0",
  tr: "border-b border-[var(--border-muted)] last:border-0",
  td: "px-2 py-3 text-[var(--text)] first:pl-0",
  tdMuted: "px-2 py-3 text-[var(--text-muted)] first:pl-0",
  tdRight: "px-2 py-3 text-right text-[var(--text)] last:pr-0",
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
  empty: "text-sm text-[var(--text-muted)]",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function WarningsPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ warnUserId?: string; warnOrder?: string; caseUserId?: string; caseOrder?: string }>;
}) {
  const { guildId } = await params;
  const { warnUserId, warnOrder, caseUserId, caseOrder } = await searchParams;
  const warnSortAsc = warnOrder === "asc";
  const caseSortAsc = caseOrder === "asc";
  await connectDB();

  // Fetch by guild only — filtering by the search term (ID or username) happens in-memory below,
  // once member names are resolved, so a typed username can match rows a Mongo userId query can't.
  const [allWarns, allCases] = await Promise.all([
    Warn.find({ guildId })
      .sort({ createdAt: warnSortAsc ? 1 : -1 })
      .limit(50)
      .lean<WarnDoc[]>(),
    Case.find({ guildId })
      .sort({ caseId: caseSortAsc ? 1 : -1 })
      .limit(50)
      .lean<CaseDoc[]>(),
  ]);

  const uniqueUserIds = [
    ...new Set([
      ...allWarns.flatMap((w) => [w.userId, w.moderatorId]),
      ...allCases.flatMap((c) => [c.userId, c.moderatorId]),
    ]),
  ];
  const nameEntries = await Promise.all(
    uniqueUserIds.map(async (id) => [id, await fetchGuildMemberName(guildId, id)] as const)
  );
  const memberNames = new Map(nameEntries);

  // Matches the search term against a row's raw user/moderator IDs or their resolved usernames,
  // so typing either an ID or a (partial, case-insensitive) username returns the right rows.
  // Scoped to the 50 most-recently-fetched rows above, same recency window as before.
  function matchesSearch(term: string, ...ids: string[]) {
    const needle = term.trim().toLowerCase();
    if (!needle) return true;
    return ids.some((id) => {
      if (id.toLowerCase().includes(needle)) return true;
      const name = memberNames.get(id);
      return !!name && name.toLowerCase().includes(needle);
    });
  }

  const warns = warnUserId?.trim()
    ? allWarns.filter((w) => matchesSearch(warnUserId, w.userId, w.moderatorId))
    : allWarns;
  const cases = caseUserId?.trim()
    ? allCases.filter((c) => matchesSearch(caseUserId, c.userId, c.moderatorId))
    : allCases;

  function toggleWarnOrderHref() {
    const p = new URLSearchParams();
    if (warnUserId?.trim()) p.set("warnUserId", warnUserId.trim());
    p.set("warnOrder", warnSortAsc ? "desc" : "asc");
    if (caseUserId?.trim()) p.set("caseUserId", caseUserId.trim());
    if (caseOrder && caseOrder !== "desc") p.set("caseOrder", caseOrder);
    return `?${p.toString()}`;
  }

  function toggleCaseOrderHref() {
    const p = new URLSearchParams();
    if (warnUserId?.trim()) p.set("warnUserId", warnUserId.trim());
    if (warnOrder && warnOrder !== "desc") p.set("warnOrder", warnOrder);
    if (caseUserId?.trim()) p.set("caseUserId", caseUserId.trim());
    p.set("caseOrder", caseSortAsc ? "desc" : "asc");
    return `?${p.toString()}`;
  }

  return (
    <>
      <h1 className={STYLES.heading}>Moderation Logs</h1>
      <div className={STYLES.grid}>
        <SettingsCard
          title="Warnings"
          description="Every warning issued, searchable by username or user ID."
          className={STYLES.warningsCard}
        >
          <WarnSearch
            defaultValue={warnUserId ?? ""}
            order={warnOrder ?? "desc"}
            paramName="warnUserId"
            orderParamName="warnOrder"
          />
          {warns.length === 0 ? (
            <p className={STYLES.empty}>
              {warnUserId ? `No warnings found for "${warnUserId}".` : "No warnings issued yet."}
            </p>
          ) : (
            <div className={STYLES.tableScroll}>
              <table className={STYLES.table}>
                <thead className={STYLES.thead}>
                  <tr>
                    <th className={STYLES.thSortable}>
                      <Link href={toggleWarnOrderHref()}>
                        # {warnSortAsc ? "↑" : "↓"}
                      </Link>
                    </th>
                    <th className={STYLES.th}>User</th>
                    <th className={STYLES.th}>Moderator</th>
                    <th className={STYLES.th}>Reason</th>
                    <th className={STYLES.thSortableRight}>
                      <Link href={toggleWarnOrderHref()}>
                        Date {warnSortAsc ? "↑" : "↓"}
                      </Link>
                    </th>
                    <th className={STYLES.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {warns.map((w, i) => (
                    <tr key={String(w._id)} className={STYLES.tr}>
                      <td className={STYLES.tdMuted}>#{warnSortAsc ? i + 1 : warns.length - i}</td>
                      <td className={STYLES.td}>
                        <CopyOnClick value={w.userId} truncate={!!memberNames.get(w.userId)} title={`Click to copy ID: ${w.userId}`}>
                          {memberNames.get(w.userId) ?? "Unknown user"}
                        </CopyOnClick>
                      </td>
                      <td className={STYLES.tdMuted}>
                        <CopyOnClick value={w.moderatorId} truncate={!!memberNames.get(w.moderatorId)} title={`Click to copy ID: ${w.moderatorId}`}>
                          {memberNames.get(w.moderatorId) ?? "Unknown user"}
                        </CopyOnClick>
                      </td>
                      <td className={STYLES.td}>{w.reason}</td>
                      <td className={STYLES.tdRight}>{formatDate(w.createdAt)}</td>
                      <td className="py-3 pl-2 text-right">
                        <DeleteWarnButton guildId={guildId} warnId={String(w._id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SettingsCard>
        <SettingsCard
          title="Case Log"
          description="Every moderation action, searchable by username or user ID."
          className={STYLES.casesCard}
        >
          <CaseSearch
            defaultValue={caseUserId ?? ""}
            order={caseOrder ?? "desc"}
            paramName="caseUserId"
            orderParamName="caseOrder"
          />
          {cases.length === 0 ? (
            <p className={STYLES.empty}>
              {caseUserId ? `No cases found for "${caseUserId}".` : "No cases logged yet."}
            </p>
          ) : (
            <div className={STYLES.tableScroll}>
              <table className={STYLES.table}>
                <thead className={STYLES.thead}>
                  <tr>
                    <th className={STYLES.thSortable}>
                      <Link href={toggleCaseOrderHref()}>
                        # {caseSortAsc ? "↑" : "↓"}
                      </Link>
                    </th>
                    <th className={STYLES.th}>Type</th>
                    <th className={STYLES.th}>User</th>
                    <th className={STYLES.th}>Moderator</th>
                    <th className={STYLES.th}>Reason</th>
                    <th className={STYLES.thSortableRight}>
                      <Link href={toggleCaseOrderHref()}>
                        Date {caseSortAsc ? "↑" : "↓"}
                      </Link>
                    </th>
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
                        <CopyOnClick value={c.userId} truncate={!!memberNames.get(c.userId)} title={`Click to copy ID: ${c.userId}`}>
                          {memberNames.get(c.userId) ?? "Unknown user"}
                        </CopyOnClick>
                      </td>
                      <td className={STYLES.tdMuted}>
                        <CopyOnClick value={c.moderatorId} truncate={!!memberNames.get(c.moderatorId)} title={`Click to copy ID: ${c.moderatorId}`}>
                          {memberNames.get(c.moderatorId) ?? "Unknown user"}
                        </CopyOnClick>
                      </td>
                      <td className={STYLES.td}>{c.reason}</td>
                      <td className={STYLES.tdRight}>{formatDate(c.createdAt)}</td>
                      <td className="py-3 pl-2 text-right">
                        <DeleteCaseButton guildId={guildId} caseId={c.caseId} />
                      </td>
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
