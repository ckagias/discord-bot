import { connectDB } from "@/lib/db";
import { fetchGuildChannels, fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import Suggestion, { SuggestionDoc } from "@/lib/models/Suggestion";
import SettingsCard from "@/components/SettingsCard";
import SectionForm from "@/components/SectionForm";
import { ChannelField, RoleField } from "@/components/Field";
import { SuggestionReviewActions, DeleteSuggestionButton } from "./SuggestionActions";
import { updateSuggestionSettings } from "./actions";

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
  badge: (status: SuggestionDoc["status"]) => {
    const map: Record<SuggestionDoc["status"], string> = {
      pending: "bg-[var(--warning)]/10 text-[var(--warning)]",
      approved: "bg-[var(--success)]/10 text-[var(--success)]",
      denied: "bg-[var(--danger)]/10 text-[var(--danger)]",
      implemented: "bg-[var(--primary)]/10 text-[var(--primary)]",
    };
    return ["inline-block rounded px-1.5 py-0.5 text-xs font-semibold capitalize", map[status]].join(" ");
  },
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

const TEXT_CHANNEL_TYPE = 0;

export default async function SuggestionsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [guildDoc, channels, roles, suggestions] = await Promise.all([
    Guild.findOne({ guildId }).lean<GuildDoc>(),
    fetchGuildChannels(guildId),
    fetchGuildRoles(guildId),
    Suggestion.find({ guildId }).sort({ createdAt: -1 }).limit(50).lean<SuggestionDoc[]>(),
  ]);

  const guild: Pick<GuildDoc, "suggestChannelId" | "suggestApproverRoleId"> = guildDoc ?? {
    suggestChannelId: null,
    suggestApproverRoleId: null,
  };
  const textChannels = channels.filter((c) => c.type === TEXT_CHANNEL_TYPE);

  const pending = suggestions.filter((s) => s.status === "pending");
  const resolved = suggestions.filter((s) => s.status !== "pending");

  return (
    <>
      <h1 className={STYLES.heading}>Suggestions</h1>
      <div className="max-w-xl">
        <div className="mb-6">
          <SectionForm action={updateSuggestionSettings.bind(null, guildId)}>
            <SettingsCard title="Suggestion box" description="Where suggestions are posted and who can review them.">
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
            </SettingsCard>
          </SectionForm>
        </div>
        <SettingsCard title="Pending" description="Approve, deny, or mark implemented.">
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
      </div>
    </>
  );
}
