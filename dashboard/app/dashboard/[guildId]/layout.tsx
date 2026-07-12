import { notFound, redirect } from "next/navigation";
import { ForbiddenError, requireGuildAccess } from "@/lib/authorize";
import {
  fetchBotJoinedAt,
  fetchGuildChannels,
  fetchGuildMemberName,
  fetchGuildRoles,
  fetchGuildStats,
  fetchUserGuilds,
} from "@/lib/discord";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/db";
import MessageActivity from "@/lib/models/MessageActivity";
import Ticket from "@/lib/models/Ticket";
import Suggestion from "@/lib/models/Suggestion";
import Warn from "@/lib/models/Warn";
import Level, { LevelDoc } from "@/lib/models/Level";
import GuildNav from "@/components/GuildNav";
import DashboardTopbar from "@/components/DashboardTopbar";
import GuildStatsPanel from "@/components/GuildStatsPanel";
import ContentColumn from "@/components/ContentColumn";

const ACTIVITY_DAYS = 7;

function recentDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function fetchMessageActivity(guildId: string): Promise<number[]> {
  await connectDB();
  const dates = recentDates(ACTIVITY_DAYS);
  const docs = await MessageActivity.find({ guildId, date: { $in: dates } })
    .lean<{ date: string; count: number }[]>();
  const byDate = new Map(docs.map((d) => [d.date, d.count]));
  return dates.map((date) => byDate.get(date) ?? 0);
}

interface OpenItems {
  openTickets: number;
  pendingSuggestions: number;
  totalWarnings: number;
}

async function fetchOpenItems(guildId: string): Promise<OpenItems> {
  await connectDB();
  const [openTickets, pendingSuggestions, totalWarnings] = await Promise.all([
    Ticket.countDocuments({ guildId, status: "open" }),
    Suggestion.countDocuments({ guildId, status: "pending" }),
    Warn.countDocuments({ guildId }),
  ]);
  return { openTickets, pendingSuggestions, totalWarnings };
}

const TOP_MEMBERS_LIMIT = 3;

async function fetchTopMembers(guildId: string): Promise<LevelDoc[]> {
  await connectDB();
  return Level.find({ guildId, level: { $gte: 1 } })
    .sort({ level: -1, xp: -1 })
    .limit(TOP_MEMBERS_LIMIT)
    .lean<LevelDoc[]>();
}

const STYLES = {
  shell: "flex h-screen flex-col overflow-hidden bg-[var(--bg-dark)] font-sans",
  page: "flex flex-1 min-h-0",
  sidebar:
    "flex w-56 shrink-0 flex-col overflow-y-auto border-r border-[var(--border-muted)] px-4 pt-4 pb-6",
  main: "flex-1 overflow-y-auto px-10 pt-6 pb-10",
  mainInner: "flex w-full justify-between gap-8",
  rail: "hidden shrink-0 xl:block",
};

function guildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png`;
}

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;

  try {
    await requireGuildAccess(guildId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      notFound();
    }
    console.error(`[guild layout] access check failed for guild ${guildId}:`, err);
    throw err;
  }

  const session = await getSession();
  if (!session.accessToken) {
    redirect("/");
  }

  const [
    userGuilds,
    stats,
    channels,
    roles,
    botJoinedAt,
    messageActivity,
    openItems,
    topMembers,
  ] = await Promise.all([
    fetchUserGuilds(session.accessToken),
    fetchGuildStats(guildId).catch(() => null),
    fetchGuildChannels(guildId).catch(() => []),
    fetchGuildRoles(guildId).catch(() => []),
    fetchBotJoinedAt(guildId).catch(() => null),
    fetchMessageActivity(guildId).catch(() => []),
    fetchOpenItems(guildId).catch(() => null),
    fetchTopMembers(guildId).catch(() => []),
  ]);
  const guild = userGuilds.find((g) => g.id === guildId);
  const iconUrl = guild ? guildIconUrl(guild.id, guild.icon) : null;
  const initial = guild?.name?.charAt(0).toUpperCase() ?? "?";
  const username = session.username ?? "Account";

  const topMemberNameEntries = await Promise.all(
    topMembers.map(async (m) => [m.userId, await fetchGuildMemberName(guildId, m.userId)] as const)
  );
  const topMemberNames = new Map(topMemberNameEntries);

  return (
    <div className={STYLES.shell}>
      <DashboardTopbar
        userId={session.userId ?? ""}
        username={username}
        avatar={session.avatar ?? null}
        guild={{ id: guildId, name: guild?.name ?? "Server", iconUrl, initial }}
      />
      <div className={STYLES.page}>
        <aside className={STYLES.sidebar}>
          <GuildNav guildId={guildId} />
        </aside>
        <main className={STYLES.main}>
          <div className={STYLES.mainInner}>
            <ContentColumn>{children}</ContentColumn>
            <div className={STYLES.rail}>
              <GuildStatsPanel
                stats={stats}
                channelCount={channels.length}
                roleCount={roles.length}
                botJoinedAt={botJoinedAt}
                messageActivity={messageActivity}
                openItems={openItems}
                topMembers={topMembers}
                topMemberNames={topMemberNames}
                guildId={guildId}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
