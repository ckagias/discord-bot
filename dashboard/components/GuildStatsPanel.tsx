import Link from "next/link";
import { GuildStats } from "@/lib/discord";
import { LevelDoc } from "@/lib/models/Level";
import CopyOnClick from "@/components/CopyOnClick";

const STYLES = {
  panel: "flex w-64 shrink-0 flex-col",
  title: "mb-4 text-2xl font-semibold text-[var(--text)]",
  card:
    "flex flex-col gap-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-5 py-5 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  stat: "flex items-center justify-between",
  statLabel: "text-sm text-[var(--text-muted)]",
  statValue: "text-sm font-medium text-[var(--text)]",
  activityCard:
    "mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-5 py-5 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  activityHeader: "flex items-center justify-between",
  activityLabel: "text-sm text-[var(--text-muted)]",
  activityTotal: "text-sm font-medium text-[var(--text)]",
  activityChart: "flex gap-1.5",
  activityBarWrap: "flex flex-1 flex-col items-center gap-1.5",
  activityBarTrack: "flex h-16 w-full items-end",
  activityBar: "w-full rounded-sm bg-[var(--primary)]/70",
  activityDayLabel: "text-[0.625rem] text-[var(--text-muted)]",
  openItemsCard:
    "mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-5 py-5 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  openItemsRow:
    "flex items-center justify-between rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-[var(--bg-light)]",
  openItemsLabel: "text-sm text-[var(--text-muted)]",
  openItemsValue: "text-sm font-medium text-[var(--text)]",
  topMembersCard:
    "mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-5 py-5 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  topMembersTitle: "text-sm text-[var(--text-muted)]",
  topMembersRow: "flex items-center gap-2 text-sm",
  topMembersRank: "w-4 shrink-0 font-semibold text-[var(--text-muted)]",
  topMembersUser: "flex-1 truncate text-sm text-[var(--text)]",
  topMembersLevel: "shrink-0 text-[var(--text-muted)]",
};

const VERIFICATION_LEVELS = ["None", "Low", "Medium", "High", "Highest"];
const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function recentDayLabels(days: number): string[] {
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    labels.push(WEEKDAY_INITIALS[d.getUTCDay()]);
  }
  return labels;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface OpenItems {
  openTickets: number;
  pendingSuggestions: number;
  totalWarnings: number;
}

interface Props {
  stats: GuildStats | null;
  channelCount: number;
  roleCount: number;
  botJoinedAt: string | null;
  messageActivity: number[];
  openItems: OpenItems | null;
  topMembers: LevelDoc[];
  topMemberNames: Map<string, string | null>;
  guildId: string;
}

export default function GuildStatsPanel({
  stats,
  channelCount,
  roleCount,
  botJoinedAt,
  messageActivity,
  openItems,
  topMembers,
  topMemberNames,
  guildId,
}: Props) {
  if (!stats) return null;

  const activityTotal = messageActivity.reduce((sum, n) => sum + n, 0);
  const activityMax = Math.max(...messageActivity, 1);
  const dayLabels = recentDayLabels(messageActivity.length);

  return (
    <div className={STYLES.panel}>
      <h2 className={STYLES.title}>Server stats</h2>
      <div className={STYLES.card}>
        <div className={STYLES.stat}>
          <span className={STYLES.statLabel}>Members</span>
          <span className={STYLES.statValue}>{stats.memberCount.toLocaleString()}</span>
        </div>
        {stats.onlineCount !== null && (
          <div className={STYLES.stat}>
            <span className={STYLES.statLabel}>Online</span>
            <span className={STYLES.statValue}>{stats.onlineCount.toLocaleString()}</span>
          </div>
        )}
        <div className={STYLES.stat}>
          <span className={STYLES.statLabel}>Boosts</span>
          <span className={STYLES.statValue}>
            {stats.boostCount.toLocaleString()} (Tier {stats.boostTier})
          </span>
        </div>
        <div className={STYLES.stat}>
          <span className={STYLES.statLabel}>Verification</span>
          <span className={STYLES.statValue}>
            {VERIFICATION_LEVELS[stats.verificationLevel] ?? "Unknown"}
          </span>
        </div>
        <div className={STYLES.stat}>
          <span className={STYLES.statLabel}>Channels</span>
          <span className={STYLES.statValue}>{channelCount.toLocaleString()}</span>
        </div>
        <div className={STYLES.stat}>
          <span className={STYLES.statLabel}>Roles</span>
          <span className={STYLES.statValue}>{roleCount.toLocaleString()}</span>
        </div>
        <div className={STYLES.stat}>
          <span className={STYLES.statLabel}>Created</span>
          <span className={STYLES.statValue}>{formatDate(stats.createdAt)}</span>
        </div>
        {botJoinedAt && (
          <div className={STYLES.stat}>
            <span className={STYLES.statLabel}>Bot added</span>
            <span className={STYLES.statValue}>{formatDate(botJoinedAt)}</span>
          </div>
        )}
      </div>
      {messageActivity.length > 0 && (
        <div className={STYLES.activityCard}>
          <div className={STYLES.activityHeader}>
            <span className={STYLES.activityLabel}>Messages (7d)</span>
            <span className={STYLES.activityTotal}>{activityTotal.toLocaleString()}</span>
          </div>
          <div className={STYLES.activityChart}>
            {messageActivity.map((count, i) => (
              <div key={i} className={STYLES.activityBarWrap}>
                <div className={STYLES.activityBarTrack}>
                  <div
                    className={STYLES.activityBar}
                    style={{ height: `${Math.max((count / activityMax) * 100, count > 0 ? 6 : 2)}%` }}
                    title={`${count.toLocaleString()} messages`}
                  />
                </div>
                <span className={STYLES.activityDayLabel}>{dayLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {openItems && (
        <div className={STYLES.openItemsCard}>
          <Link href={`/dashboard/${guildId}/tickets`} className={STYLES.openItemsRow}>
            <span className={STYLES.openItemsLabel}>Open tickets</span>
            <span className={STYLES.openItemsValue}>{openItems.openTickets.toLocaleString()}</span>
          </Link>
          <Link href={`/dashboard/${guildId}/suggestions`} className={STYLES.openItemsRow}>
            <span className={STYLES.openItemsLabel}>Pending suggestions</span>
            <span className={STYLES.openItemsValue}>
              {openItems.pendingSuggestions.toLocaleString()}
            </span>
          </Link>
          <Link href={`/dashboard/${guildId}/warnings`} className={STYLES.openItemsRow}>
            <span className={STYLES.openItemsLabel}>Total warnings</span>
            <span className={STYLES.openItemsValue}>{openItems.totalWarnings.toLocaleString()}</span>
          </Link>
        </div>
      )}
      {topMembers.length > 0 && (
        <div className={STYLES.topMembersCard}>
          <span className={STYLES.topMembersTitle}>Top members</span>
          {topMembers.map((entry, i) => (
            <div key={entry.userId} className={STYLES.topMembersRow}>
              <span className={STYLES.topMembersRank}>#{i + 1}</span>
              <CopyOnClick
                value={entry.userId}
                truncate={!!topMemberNames.get(entry.userId)}
                title={`Click to copy ID: ${entry.userId}`}
                className={STYLES.topMembersUser}
              >
                {topMemberNames.get(entry.userId) ?? "Unknown user"}
              </CopyOnClick>
              <span className={STYLES.topMembersLevel}>Lvl {entry.level}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
