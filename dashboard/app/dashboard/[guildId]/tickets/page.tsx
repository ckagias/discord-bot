import Link from "next/link";
import { connectDB } from "@/lib/db";
import { fetchGuildChannels, fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import Ticket, { TicketDoc } from "@/lib/models/Ticket";
import SettingsCard from "@/components/SettingsCard";
import SectionForm from "@/components/SectionForm";
import { ChannelField, RoleField } from "@/components/Field";
import { updateTicketSettings } from "./actions";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-[var(--text)]",
  stack: "flex flex-col gap-8 max-w-xl",
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
  code: "rounded bg-[var(--bg-light)] px-1.5 py-0.5 text-xs",
  empty: "text-sm text-[var(--text-muted)]",
  filterBar: "mb-6 flex gap-2",
  filterLink: (active: boolean) =>
    [
      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-[var(--primary)]/10 text-[var(--primary)]"
        : "border border-[var(--border-muted)] text-[var(--text-muted)] hover:bg-[var(--bg-light)]",
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
  searchParams: Promise<{ status?: string; order?: string }>;
}) {
  const { guildId } = await params;
  const { status, order } = await searchParams;
  const sortAsc = order === "asc";
  await connectDB();

  const ticketQuery: Record<string, unknown> = { guildId };
  if (status === "open" || status === "closed") ticketQuery.status = status;

  const [guildDoc, channels, roles, tickets] = await Promise.all([
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

  function toggleOrderHref() {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    p.set("order", sortAsc ? "desc" : "asc");
    return `?${p.toString()}`;
  }

  function statusFilterHref(s?: string) {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (order && order !== "desc") p.set("order", order);
    const qs = p.toString();
    return qs ? `?${qs}` : "?";
  }

  return (
    <>
      <h1 className={STYLES.heading}>Tickets</h1>
      <div className={STYLES.stack}>
        <SectionForm action={updateTicketSettings.bind(null, guildId)}>
          <SettingsCard
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
          </SettingsCard>
        </SectionForm>
        <SettingsCard title="Open & recent tickets" description="Last 50, newest first.">
          <div className={STYLES.filterBar}>
            <Link href={statusFilterHref()} className={STYLES.filterLink(!status)}>All</Link>
            <Link href={statusFilterHref("open")} className={STYLES.filterLink(status === "open")}>Open</Link>
            <Link href={statusFilterHref("closed")} className={STYLES.filterLink(status === "closed")}>Closed</Link>
          </div>
          {tickets.length === 0 ? (
            <p className={STYLES.empty}>
              {status ? `No ${status} tickets found.` : "No tickets created yet."}
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
                  <th className={STYLES.th}>User</th>
                  <th className={STYLES.th}>Status</th>
                  <th className={STYLES.thRight}>Date</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.ticketNumber} className={STYLES.tr}>
                    <td className={STYLES.tdMuted}>#{t.ticketNumber}</td>
                    <td className={STYLES.td}>
                      <code className={STYLES.code}>{t.userId}</code>
                    </td>
                    <td className={STYLES.td}>
                      <span className={STYLES.statusBadge(t.status)}>{t.status}</span>
                    </td>
                    <td className={STYLES.tdRight}>{formatDate(t.createdAt)}</td>
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
