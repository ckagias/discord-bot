import Link from "next/link";
import { redirect } from "next/navigation";
import { DiscordGuild, fetchBotGuildIds, fetchUserGuilds, hasManageGuild } from "@/lib/discord";
import { getSession } from "@/lib/session";
import DashboardTopbar from "@/components/DashboardTopbar";

const STYLES = {
  page: "flex flex-col flex-1 bg-[var(--bg-dark)] font-sans",
  main: "flex-1 px-8 py-10 max-w-3xl w-full mx-auto",
  sectionTitle: "text-sm font-medium text-[var(--text-muted)] mb-4",
  grid: "grid grid-cols-1 sm:grid-cols-2 gap-4",
  guildCard:
    "flex items-center gap-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-5 py-4 transition-all duration-200 hover:border-[var(--primary)]/40 hover:shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  guildIcon: "h-10 w-10 shrink-0 rounded-full object-cover",
  guildIconFallback:
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-base font-semibold text-[var(--bg-dark)]",
  guildName: "text-sm font-medium text-[var(--text)]",
  empty:
    "flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border)] px-8 py-16 text-center",
  emptyTitle: "text-sm font-medium text-[var(--text)]",
  emptyText: "max-w-sm text-sm text-[var(--text-muted)]",
};

function guildIconUrl(guild: DiscordGuild): string | null {
  if (!guild.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.userId || !session.accessToken) {
    redirect("/");
  }

  let userGuilds: DiscordGuild[] = [];
  let botGuildIds: Set<string> = new Set();
  try {
    [userGuilds, botGuildIds] = await Promise.all([
      fetchUserGuilds(session.accessToken),
      fetchBotGuildIds(),
    ]);
  } catch {
    redirect("/api/auth/login");
  }

  const manageable = userGuilds.filter(
    (g) => hasManageGuild(g) && botGuildIds.has(g.id)
  );

  return (
    <div className={STYLES.page}>
      <DashboardTopbar
        userId={session.userId ?? ""}
        username={session.username ?? "Account"}
        avatar={session.avatar ?? null}
      />
      <main className={STYLES.main}>
        <p className={STYLES.sectionTitle}>
          Servers where you can manage the bot
        </p>
        {manageable.length === 0 ? (
          <div className={STYLES.empty}>
            <p className={STYLES.emptyTitle}>No manageable servers found</p>
            <p className={STYLES.emptyText}>
              Make sure the bot has been invited to a server where you have the
              Manage Server permission, then refresh this page.
            </p>
          </div>
        ) : (
          <div className={STYLES.grid}>
            {manageable.map((g) => {
              const iconUrl = guildIconUrl(g);
              return (
                <Link
                  key={g.id}
                  href={`/dashboard/${g.id}`}
                  className={STYLES.guildCard}
                >
                  {iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconUrl} alt="" className={STYLES.guildIcon} />
                  ) : (
                    <span className={STYLES.guildIconFallback}>
                      {g.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className={STYLES.guildName}>{g.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}