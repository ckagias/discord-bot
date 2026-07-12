import Link from "next/link";
import { connectDB } from "@/lib/db";
import { fetchGuildChannels, fetchGuildMemberName, fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import Suggestion, { SuggestionDoc } from "@/lib/models/Suggestion";
import SettingsCard from "@/components/SettingsCard";
import SettingsCardForm from "@/components/SettingsCardForm";
import CopyOnClick from "@/components/CopyOnClick";
import { ChannelField, RoleField } from "@/components/Field";
import { SuggestionReviewActions, DeleteSuggestionButton } from "./SuggestionActions";
import { updateSuggestionSettings } from "./actions";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
  table: "w-full text-sm",
  thead: "border-b border-[var(--border-muted)]",
  theadSticky: "sticky top-0 border-b border-[var(--border-muted)] bg-[var(--bg)]",
  th: "w-px whitespace-nowrap px-2 pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] first:pl-0",
  thAuthor: "px-2 pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
  thSortable:
    "w-px cursor-pointer select-none whitespace-nowrap px-2 pb-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text)] first:pl-0",
  thSortableRight:
    "w-px cursor-pointer select-none whitespace-nowrap px-2 pb-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text)]",
  tr: "border-b border-[var(--border-muted)] last:border-0",
  td: "w-px whitespace-nowrap px-2 py-3 text-[var(--text)] first:pl-0",
  tdAuthor: "px-2 py-3 text-[var(--text-muted)]",
  tdMuted: "w-px whitespace-nowrap px-2 py-3 text-[var(--text-muted)]",
  tdRight: "w-px whitespace-nowrap px-2 py-3 text-right text-[var(--text)]",
  tdActions: "w-px whitespace-nowrap py-3 pl-2 pr-0 text-right",
  badge: (status: SuggestionDoc["status"]) => {
    const map: Record<SuggestionDoc["status"], string> = {
      pending: "bg-[var(--warning)]/10 text-[var(--warning)]",
      approved: "bg-[var(--success)]/10 text-[var(--success)]",
      denied: "bg-[var(--danger)]/10 text-[var(--danger)]",
      implemented: "bg-[var(--primary)]/10 text-[var(--primary)]",
    };
    return ["inline-block rounded px-1.5 py-0.5 text-xs font-semibold capitalize", map[status]].join(" ");
  },
  empty: "text-sm text-[var(--text-muted)]",
  actions: "flex items-center justify-end gap-1",
  grid: "grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start",
  leftCol: "flex flex-col gap-6",
  pendingCard: "rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-6 py-6 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  pendingScroll: "max-h-[41.1rem] overflow-y-auto overflow-x-auto pr-3 -mr-3",
  resolvedScroll: "max-h-[18.5rem] overflow-y-auto overflow-x-auto pr-3 -mr-3",
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
  authorNames,
  stickyHeader,
  sortAsc,
  toggleOrderHref,
  showVotes = true,
}: {
  guildId: string;
  rows: SuggestionDoc[];
  reviewable: boolean;
  authorNames: Map<string, string | null>;
  stickyHeader?: boolean;
  sortAsc: boolean;
  toggleOrderHref: string;
  showVotes?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <table className={STYLES.table}>
      <thead className={stickyHeader ? STYLES.theadSticky : STYLES.thead}>
        <tr>
          <th className={STYLES.thSortable}>
            <Link href={toggleOrderHref}>
              # {sortAsc ? "↑" : "↓"}
            </Link>
          </th>
          <th className={STYLES.thAuthor}>Author</th>
          {showVotes && <th className={STYLES.th}>Votes</th>}
          <th className={STYLES.th}>Status</th>
          <th className={STYLES.thSortableRight}>
            <Link href={toggleOrderHref}>
              Date {sortAsc ? "↑" : "↓"}
            </Link>
          </th>
          <th className={STYLES.th} />
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const authorName = authorNames.get(s.authorId);
          // Display index over this sub-table's rows — newest gets the highest #, matching
          // the shared date-derived numbering used across the dashboard's other tables.
          const displayIndex = sortAsc ? i + 1 : rows.length - i;
          return (
            <tr key={s.messageId} className={STYLES.tr}>
              <td className={STYLES.td}>
                <a href={jumpUrl(s)} target="_blank" rel="noreferrer" title={s.content} className="hover:underline">
                  #{displayIndex}
                </a>
              </td>
              <td className={STYLES.tdAuthor}>
                <CopyOnClick value={s.authorId} truncate={!!authorName} title={`Click to copy ID: ${s.authorId}`}>
                  {authorName ?? "Unknown user"}
                </CopyOnClick>
              </td>
              {showVotes && (
                <td className={STYLES.tdMuted}>
                  👍 {s.upvotes.length} 👎 {s.downvotes.length}
                </td>
              )}
              <td className={STYLES.td}>
                <span className={STYLES.badge(s.status)}>{s.status}</span>
              </td>
              <td className={STYLES.tdRight}>{formatDate(s.createdAt)}</td>
              <td className={STYLES.tdActions}>
                <div className={STYLES.actions}>
                  {reviewable ? (
                    <SuggestionReviewActions guildId={guildId} messageId={s.messageId} />
                  ) : (
                    <DeleteSuggestionButton guildId={guildId} messageId={s.messageId} />
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const TEXT_CHANNEL_TYPE = 0;

export default async function SuggestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { guildId } = await params;
  const { order } = await searchParams;
  const sortAsc = order === "asc";
  await connectDB();

  const [guildDoc, channels, roles, suggestions] = await Promise.all([
    Guild.findOne({ guildId }).lean<GuildDoc>(),
    fetchGuildChannels(guildId),
    fetchGuildRoles(guildId),
    Suggestion.find({ guildId }).sort({ createdAt: sortAsc ? 1 : -1 }).limit(50).lean<SuggestionDoc[]>(),
  ]);

  const guild: Pick<GuildDoc, "suggestChannelId" | "suggestApproverRoleId"> = guildDoc ?? {
    suggestChannelId: null,
    suggestApproverRoleId: null,
  };
  const textChannels = channels.filter((c) => c.type === TEXT_CHANNEL_TYPE);

  const pending = suggestions.filter((s) => s.status === "pending");
  const resolved = suggestions.filter((s) => s.status !== "pending");

  const uniqueAuthorIds = [...new Set(suggestions.map((s) => s.authorId))];
  const authorNameEntries = await Promise.all(
    uniqueAuthorIds.map(async (authorId) => [authorId, await fetchGuildMemberName(guildId, authorId)] as const)
  );
  const authorNames = new Map(authorNameEntries);

  function toggleOrderHref() {
    const p = new URLSearchParams();
    p.set("order", sortAsc ? "desc" : "asc");
    return `?${p.toString()}`;
  }

  return (
    <>
      <h1 className={STYLES.heading}>Suggestions</h1>
      <div className={STYLES.grid}>
        <div className={STYLES.leftCol}>
          <SettingsCardForm
            action={updateSuggestionSettings.bind(null, guildId)}
            title="Suggestion box"
            description="Where suggestions are posted and who can review them."
          >
            <ChannelField
              label="Suggestion channel"
              name="suggestChannelId"
              defaultValue={guild.suggestChannelId}
              channels={textChannels}
            />
            <RoleField
              label="Approver role"
              name="suggestApproverRoleId"
              defaultValue={guild.suggestApproverRoleId}
              roles={roles}
            />
          </SettingsCardForm>
          <SettingsCard title="Resolved" description="Suggestions that have already been reviewed.">
            {resolved.length === 0 ? (
              <p className={STYLES.empty}>No resolved suggestions yet.</p>
            ) : (
              <div className={STYLES.resolvedScroll}>
                <SuggestionTable
                  guildId={guildId}
                  rows={resolved}
                  reviewable={false}
                  authorNames={authorNames}
                  stickyHeader
                  sortAsc={sortAsc}
                  toggleOrderHref={toggleOrderHref()}
                  showVotes={false}
                />
              </div>
            )}
          </SettingsCard>
        </div>
        <SettingsCard title="Pending" description="Approve, deny, or mark implemented." className={STYLES.pendingCard}>
          {pending.length === 0 ? (
            <p className={STYLES.empty}>No pending suggestions.</p>
          ) : (
            <div className={STYLES.pendingScroll}>
              <SuggestionTable
                guildId={guildId}
                rows={pending}
                reviewable
                authorNames={authorNames}
                stickyHeader
                sortAsc={sortAsc}
                toggleOrderHref={toggleOrderHref()}
              />
            </div>
          )}
        </SettingsCard>
      </div>
    </>
  );
}
