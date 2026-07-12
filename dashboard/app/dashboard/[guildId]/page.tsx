import Link from "next/link";
import { connectDB } from "@/lib/db";
import { fetchGuildMemberName } from "@/lib/discord";
import Case from "@/lib/models/Case";
import Economy from "@/lib/models/Economy";
import Giveaway from "@/lib/models/Giveaway";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import Level, { LevelDoc } from "@/lib/models/Level";
import MessageActivity from "@/lib/models/MessageActivity";
import ReactionRole from "@/lib/models/ReactionRole";
import Shop from "@/lib/models/Shop";
import Suggestion from "@/lib/models/Suggestion";
import Ticket from "@/lib/models/Ticket";
import Trigger from "@/lib/models/Trigger";
import Warn from "@/lib/models/Warn";
import CopyOnClick from "@/components/CopyOnClick";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
  grid: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
  card:
    "flex flex-col gap-1 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-5 py-5 transition-all duration-200 hover:border-[var(--primary)]/40 hover:shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  cardValue: "text-2xl font-semibold text-[var(--text)]",
  cardLabel: "text-sm text-[var(--text-muted)]",
  section: "mt-8",
  sectionTitle: "mb-4 text-sm font-medium text-[var(--text-muted)]",
  panelsGrid: "grid grid-cols-1 gap-6 lg:grid-cols-[1fr_16rem]",
  chartCard:
    "flex flex-col rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-6 py-6 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  chartHeader: "mb-6 flex items-center justify-between",
  chartLabel: "text-sm text-[var(--text-muted)]",
  chartTotal: "text-2xl font-semibold text-[var(--text)]",
  chartArea: "h-[9rem] w-full",
  chartAxis: "mt-2 flex justify-between text-[0.6875rem] text-[var(--text-muted)]",
  sideStack: "flex flex-col gap-6",
  activityGrid: "grid grid-cols-1 gap-6 lg:grid-cols-[1fr_16rem]",
  listCard:
    "flex min-h-[19.875rem] flex-col gap-4 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-5 py-5 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  topMembersCard:
    "flex min-h-[17.375rem] flex-col gap-4 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-5 py-5 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  communityCard:
    "flex min-h-[19.875rem] flex-col gap-4 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-5 py-5 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  communityList: "flex flex-col gap-3",
  communityRow:
    "flex items-center justify-between rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-[var(--bg-light)]",
  communityLabel: "text-sm text-[var(--text-muted)]",
  communityValue: "text-sm font-medium text-[var(--text)]",
  leaderList: "flex flex-col gap-4",
  listTitle: "text-sm font-medium text-[var(--text)]",
  activityList: "flex flex-col gap-3",
  activityItem: "flex items-start justify-between gap-3 py-0.5 text-sm",
  activityText: "text-[var(--text)]",
  activityLink: "hover:underline",
  activityUser: "font-medium text-[var(--text)] hover:underline",
  activityMuted: "shrink-0 text-[var(--text-muted)]",
  activityEmpty:
    "flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--border-muted)] px-4 py-8 text-center text-sm text-[var(--text-muted)]",
  leaderRow: "flex items-center justify-between text-sm",
  leaderRank: "w-6 font-semibold text-[var(--text-muted)]",
  leaderUser: "flex-1 truncate text-[var(--text)]",
  leaderXp: "text-[var(--text-muted)] tabular-nums",
};

const ACTIVITY_DAYS = 14;
const TOP_MEMBERS_LIMIT = 6;
const RECENT_ACTIVITY_LIMIT = 7;

function recentDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ActivityEvent {
  prefix: string;
  userId?: string;
  suffix?: string;
  createdAt: Date;
  href: string;
}

export default async function GuildOverviewPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [
    openTickets,
    pendingSuggestions,
    caseCount,
    warnCount,
    activityDocs,
    topLevels,
    recentWarns,
    recentCases,
    recentTickets,
    recentSuggestions,
    coinsAgg,
    activeGiveaways,
    shopItemCount,
    reactionRoleCount,
    triggerCount,
    approvedSuggestions,
    guildDoc,
  ] = await Promise.all([
    Ticket.countDocuments({ guildId, status: "open" }),
    Suggestion.countDocuments({ guildId, status: "pending" }),
    Case.countDocuments({ guildId }),
    Warn.countDocuments({ guildId }),
    MessageActivity.find({ guildId, date: { $in: recentDates(ACTIVITY_DAYS) } })
      .lean<{ date: string; count: number }[]>(),
    Level.find({ guildId, level: { $gte: 1 } })
      .sort({ level: -1, xp: -1 })
      .limit(TOP_MEMBERS_LIMIT)
      .lean<LevelDoc[]>(),
    Warn.find({ guildId }).sort({ createdAt: -1 }).limit(RECENT_ACTIVITY_LIMIT).lean<{ userId: string; createdAt: Date }[]>(),
    Case.find({ guildId }).sort({ createdAt: -1 }).limit(RECENT_ACTIVITY_LIMIT).lean<{ type: string; userId: string; createdAt: Date }[]>(),
    Ticket.find({ guildId }).sort({ createdAt: -1 }).limit(RECENT_ACTIVITY_LIMIT).lean<{ ticketNumber: number; status: string; createdAt: Date }[]>(),
    Suggestion.find({ guildId }).sort({ createdAt: -1 }).limit(RECENT_ACTIVITY_LIMIT).lean<{ authorId: string; status: string; createdAt: Date }[]>(),
    Economy.aggregate<{ _id: null; total: number }>([
      { $match: { guildId } },
      { $group: { _id: null, total: { $sum: "$balance" } } },
    ]),
    Giveaway.countDocuments({ guildId, ended: false }),
    Shop.countDocuments({ guildId, enabled: true }),
    ReactionRole.distinct("messageId", { guildId }).then((ids) => ids.length),
    Trigger.countDocuments({ guildId }),
    Suggestion.countDocuments({ guildId, status: "approved" }),
    Guild.findOne({ guildId }, { warnThresholds: 1 }).lean<Pick<GuildDoc, "warnThresholds"> | null>(),
  ]);
  const warnThresholdCount = guildDoc?.warnThresholds.length ?? 0;
  const totalCoins = coinsAgg[0]?.total ?? 0;

  const cards = [
    { label: "Open tickets", value: openTickets, href: `/dashboard/${guildId}/tickets` },
    { label: "Pending suggestions", value: pendingSuggestions, href: `/dashboard/${guildId}/suggestions` },
    { label: "Total cases", value: caseCount, href: `/dashboard/${guildId}/warnings` },
    { label: "Total warnings", value: warnCount, href: `/dashboard/${guildId}/warnings` },
  ];

  const communityStats = [
    { label: "Coins in circulation", value: totalCoins, href: `/dashboard/${guildId}/economy` },
    { label: "Active giveaways", value: activeGiveaways, href: `/dashboard/${guildId}/giveaways` },
    { label: "Shop items", value: shopItemCount, href: `/dashboard/${guildId}/shop` },
    { label: "Reaction role messages", value: reactionRoleCount, href: `/dashboard/${guildId}/reaction-roles` },
    { label: "Triggers configured", value: triggerCount, href: `/dashboard/${guildId}/triggers` },
    { label: "Suggestions approved", value: approvedSuggestions, href: `/dashboard/${guildId}/suggestions` },
    { label: "Warn thresholds", value: warnThresholdCount, href: `/dashboard/${guildId}/thresholds` },
  ];

  const dates = recentDates(ACTIVITY_DAYS);
  const byDate = new Map(activityDocs.map((d) => [d.date, d.count]));
  const activity = dates.map((date) => byDate.get(date) ?? 0);
  const activityTotal = activity.reduce((sum, n) => sum + n, 0);
  const activityMax = Math.max(...activity, 1);

  const chartWidth = 100;
  const chartHeight = 100;
  const points = activity.map((count, i) => {
    const x = activity.length > 1 ? (i / (activity.length - 1)) * chartWidth : chartWidth / 2;
    const y = chartHeight - (count / activityMax) * chartHeight;
    return `${x},${y}`;
  });
  const linePath = `M${points.join(" L")}`;
  const areaPath = `M0,${chartHeight} L${points.join(" L")} L${chartWidth},${chartHeight} Z`;

  const events: ActivityEvent[] = [
    ...recentWarns.map((w) => ({
      prefix: "Warned",
      userId: w.userId,
      createdAt: new Date(w.createdAt),
      href: `/dashboard/${guildId}/warnings`,
    })),
    ...recentCases.map((c) => ({
      prefix: `Case: ${c.type} on`,
      userId: c.userId,
      createdAt: new Date(c.createdAt),
      href: `/dashboard/${guildId}/warnings`,
    })),
    ...recentTickets.map((t) => ({
      prefix: `Ticket #${t.ticketNumber} ${t.status === "open" ? "opened" : "closed"}`,
      createdAt: new Date(t.createdAt),
      href: `/dashboard/${guildId}/tickets`,
    })),
    ...recentSuggestions.map((s) => ({
      prefix: "Suggestion by",
      userId: s.authorId,
      suffix: `(${s.status})`,
      createdAt: new Date(s.createdAt),
      href: `/dashboard/${guildId}/suggestions`,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, RECENT_ACTIVITY_LIMIT);

  const uniqueUserIds = [
    ...new Set([
      ...topLevels.map((l) => l.userId),
      ...events.map((e) => e.userId).filter((id): id is string => !!id),
    ]),
  ];
  const nameEntries = await Promise.all(
    uniqueUserIds.map(async (id) => [id, await fetchGuildMemberName(guildId, id)] as const)
  );
  const memberNames = new Map(nameEntries);

  return (
    <>
      <h1 className={STYLES.heading}>Overview</h1>
      <div className={STYLES.grid}>
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className={STYLES.card}>
            <span className={STYLES.cardValue}>{card.value.toLocaleString()}</span>
            <span className={STYLES.cardLabel}>{card.label}</span>
          </Link>
        ))}
      </div>

      <div className={STYLES.section}>
        <div className={STYLES.panelsGrid}>
          <div className={STYLES.chartCard}>
            <div className={STYLES.chartHeader}>
              <span className={STYLES.chartLabel}>Messages ({ACTIVITY_DAYS}d)</span>
              <span className={STYLES.chartTotal}>{activityTotal.toLocaleString()}</span>
            </div>
            <svg
              className={STYLES.chartArea}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#activityFill)" stroke="none" />
              <path
                d={linePath}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className={STYLES.chartAxis}>
              <span>{new Date(dates[0]).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <span>{new Date(dates[dates.length - 1]).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            </div>
          </div>

          <div className={STYLES.sideStack}>
            <div className={STYLES.topMembersCard}>
              <span className={STYLES.listTitle}>Top members</span>
              {topLevels.length === 0 ? (
                <p className={STYLES.activityEmpty}>No one has earned XP yet.</p>
              ) : (
                <div className={STYLES.leaderList}>
                  {topLevels.map((entry, i) => (
                    <div key={entry.userId} className={STYLES.leaderRow}>
                      <span className={STYLES.leaderRank}>#{i + 1}</span>
                      <CopyOnClick
                        value={entry.userId}
                        truncate={!!memberNames.get(entry.userId)}
                        title={`Click to copy ID: ${entry.userId}`}
                        className={STYLES.leaderUser}
                      >
                        {memberNames.get(entry.userId) ?? "Unknown user"}
                      </CopyOnClick>
                      <span className={STYLES.leaderXp}>Lvl {entry.level}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={STYLES.section}>
        <div className={STYLES.activityGrid}>
          <div className={STYLES.listCard}>
            <span className={STYLES.listTitle}>Recent activity</span>
            {events.length === 0 ? (
              <p className={STYLES.activityEmpty}>No moderation or community activity yet.</p>
            ) : (
              <div className={STYLES.activityList}>
                {events.map((event, i) => {
                  const memberName = event.userId ? memberNames.get(event.userId) : null;
                  return (
                    <div key={i} className={STYLES.activityItem}>
                      <span className={STYLES.activityText}>
                        <Link href={event.href} className={STYLES.activityLink}>{event.prefix}</Link>
                        {event.userId && (
                          <>
                            {" "}
                            <CopyOnClick
                              value={event.userId}
                              truncate={!!memberName}
                              title={`Click to copy ID: ${event.userId}`}
                              className={STYLES.activityUser}
                            >
                              {memberName ?? "Unknown user"}
                            </CopyOnClick>
                          </>
                        )}
                        {event.suffix && (
                          <>
                            {" "}
                            <Link href={event.href} className={STYLES.activityLink}>{event.suffix}</Link>
                          </>
                        )}
                      </span>
                      <span className={STYLES.activityMuted}>{formatRelativeTime(event.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={STYLES.communityCard}>
            <span className={STYLES.listTitle}>Community</span>
            <div className={STYLES.communityList}>
              {communityStats.map((stat) => (
                <Link key={stat.href} href={stat.href} className={STYLES.communityRow}>
                  <span className={STYLES.communityLabel}>{stat.label}</span>
                  <span className={STYLES.communityValue}>{stat.value.toLocaleString()}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
