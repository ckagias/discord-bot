import Link from "next/link";
import { connectDB } from "@/lib/db";
import { fetchGuildChannels, fetchGuildMemberName, fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import Ticket, { TicketDoc } from "@/lib/models/Ticket";
import SettingsCard from "@/components/SettingsCard";
import SettingsCardForm from "@/components/SettingsCardForm";
import CopyOnClick from "@/components/CopyOnClick";
import { ChannelField, RoleField } from "@/components/Field";
import { updateTicketSettings } from "./actions";
import TicketSearch from "./TicketSearch";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
  grid: "grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch",
  leftCol: "flex flex-col gap-6",
  ticketsCard: "flex flex-col rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-6 py-6 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  ticketsBody: "mt-6 flex flex-1 min-h-0 flex-col gap-3.5",
  table: "w-full text-sm",
  theadSticky: "sticky top-0 border-b border-[var(--border-muted)] bg-[var(--bg)]",
  th: "pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
  thSortable:
    "cursor-pointer select-none pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text)]",
  thSortableRight:
    "cursor-pointer select-none pb-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text)]",
  tr: "border-b border-[var(--border-muted)] last:border-0",
  td: "py-3 text-[var(--text)]",
  tdMuted: "py-3 text-[var(--text-muted)]",
  tdRight: "py-3 text-right text-[var(--text)]",
  statusBadge: (status: string) => {
    const map: Record<string, string> = {
      open:   "bg-[var(--success)]/10 text-[var(--success)]",
      closed: "bg-[var(--bg-light)] text-[var(--text-muted)]",
    };
    return [
      "inline-block rounded px-1.5 py-0.5 text-xs font-semibold capitalize",
      map[status] ?? "bg-[var(--bg-light)] text-[var(--text-muted)]",
    ].join(" ");
  },
  empty: "text-sm text-[var(--text-muted)]",
  emptyWrap: "flex flex-1 min-h-0 items-center justify-center",
  filterBar: "flex shrink-0 gap-2",
  ticketsScroll: "mt-1.5 max-h-[11rem] overflow-y-auto overflow-x-auto pr-3 -mr-3",
  filterLink: (active: boolean) =>
    [
      "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
      active
        ? "border-transparent bg-[var(--primary)]/10 text-[var(--primary)]"
        : "border-[var(--border-muted)] text-[var(--text-muted)] hover:bg-[var(--bg-light)]",
    ].join(" "),
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function TicketSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ status?: string; order?: string; q?: string }>;
}) {
  const { guildId } = await params;
  const { status, order, q } = await searchParams;
  const sortAsc = order === "asc";
  await connectDB();

  const ticketQuery: Record<string, unknown> = { guildId };
  if (status === "open" || status === "closed") ticketQuery.status = status;

  const [guildDoc, channels, roles, allTickets] = await Promise.all([
    Guild.findOne({ guildId }).lean<GuildDoc>(),
    fetchGuildChannels(guildId),
    fetchGuildRoles(guildId),
    Ticket.find(ticketQuery)
      .sort({ ticketNumber: sortAsc ? 1 : -1 })
      .limit(50)
      .lean<TicketDoc[]>(),
  ]);

  const guild: Pick<GuildDoc, "ticketCategoryId" | "ticketSupportRoleId"> = guildDoc ?? {
    ticketCategoryId: null,
    ticketSupportRoleId: null,
  };

  const uniqueUserIds = [...new Set(allTickets.map((t) => t.userId))];
  const nameEntries = await Promise.all(
    uniqueUserIds.map(async (id) => [id, await fetchGuildMemberName(guildId, id)] as const)
  );
  const memberNames = new Map(nameEntries);

  // Matches the ticket number, opener's raw user ID, or their resolved username.
  const needle = q?.trim().toLowerCase() ?? "";
  const tickets = needle
    ? allTickets.filter((t) => {
        if (String(t.ticketNumber).includes(needle)) return true;
        if (t.userId.toLowerCase().includes(needle)) return true;
        const name = memberNames.get(t.userId);
        return !!name && name.toLowerCase().includes(needle);
      })
    : allTickets;

  function toggleOrderHref() {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q?.trim()) p.set("q", q.trim());
    p.set("order", sortAsc ? "desc" : "asc");
    return `?${p.toString()}`;
  }

  function statusFilterHref(s?: string) {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q?.trim()) p.set("q", q.trim());
    if (order && order !== "desc") p.set("order", order);
    const qs = p.toString();
    return qs ? `?${qs}` : "?";
  }

  return (
    <>
      <h1 className={STYLES.heading}>Tickets</h1>
      <div className={STYLES.grid}>
        <div className={STYLES.leftCol}>
          <SettingsCardForm
            action={updateTicketSettings.bind(null, guildId)}
            title="Ticket setup"
            description="Where new ticket channels are created and who can see them."
          >
            <ChannelField
              label="Ticket category"
              name="ticketCategoryId"
              defaultValue={guild.ticketCategoryId}
              channels={channels}
            />
            <RoleField
              label="Ticket support role"
              name="ticketSupportRoleId"
              defaultValue={guild.ticketSupportRoleId}
              roles={roles}
            />
          </SettingsCardForm>
        </div>
        <SettingsCard
          title="Open & recent tickets"
          description="Last 50, newest first."
          className={STYLES.ticketsCard}
          bodyClassName={STYLES.ticketsBody}
          headerAction={
            <div className={STYLES.filterBar}>
              <Link href={statusFilterHref()} className={STYLES.filterLink(!status)}>All</Link>
              <Link href={statusFilterHref("open")} className={STYLES.filterLink(status === "open")}>Open</Link>
              <Link href={statusFilterHref("closed")} className={STYLES.filterLink(status === "closed")}>Closed</Link>
            </div>
          }
        >
          <TicketSearch defaultValue={q ?? ""} />
          {tickets.length === 0 ? (
            <div className={STYLES.emptyWrap}>
              <p className={STYLES.empty}>
                {q ? `No tickets found for "${q}".` : status ? `No ${status} tickets found.` : "No tickets created yet."}
              </p>
            </div>
          ) : (
            <div className={STYLES.ticketsScroll}>
              <table className={STYLES.table}>
                <thead className={STYLES.theadSticky}>
                  <tr>
                    <th className={STYLES.thSortable}>
                      <Link href={toggleOrderHref()}>
                        # {sortAsc ? "↑" : "↓"}
                      </Link>
                    </th>
                    <th className={STYLES.th}>User</th>
                    <th className={STYLES.th}>Status</th>
                    <th className={STYLES.thSortableRight}>
                      <Link href={toggleOrderHref()}>
                        Date {sortAsc ? "↑" : "↓"}
                      </Link>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.ticketNumber} className={STYLES.tr}>
                      <td className={STYLES.tdMuted}>#{t.ticketNumber}</td>
                      <td className={STYLES.td}>
                        <CopyOnClick value={t.userId} truncate={!!memberNames.get(t.userId)} title={`Click to copy ID: ${t.userId}`}>
                          {memberNames.get(t.userId) ?? "Unknown user"}
                        </CopyOnClick>
                      </td>
                      <td className={STYLES.td}>
                        <span className={STYLES.statusBadge(t.status)}>{t.status}</span>
                      </td>
                      <td className={STYLES.tdRight}>{formatDate(t.createdAt)}</td>
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
