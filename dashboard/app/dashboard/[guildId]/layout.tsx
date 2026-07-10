import { notFound, redirect } from "next/navigation";
import { ForbiddenError, requireGuildAccess } from "@/lib/authorize";
import { fetchUserGuilds } from "@/lib/discord";
import { getSession } from "@/lib/session";
import GuildNav from "@/components/GuildNav";
import DashboardTopbar from "@/components/DashboardTopbar";

const STYLES = {
  shell: "flex h-screen flex-col overflow-hidden bg-[var(--bg-dark)] font-sans",
  page: "flex flex-1 min-h-0",
  sidebar:
    "flex w-56 shrink-0 flex-col overflow-y-auto border-r border-[var(--border-muted)] px-4 pt-4 pb-6",
  main: "flex-1 overflow-y-auto px-10 pt-6 pb-10",
  mainInner: "max-w-2xl",
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

  const userGuilds = await fetchUserGuilds(session.accessToken);
  const guild = userGuilds.find((g) => g.id === guildId);
  const iconUrl = guild ? guildIconUrl(guild.id, guild.icon) : null;
  const initial = guild?.name?.charAt(0).toUpperCase() ?? "?";
  const username = session.username ?? "Account";

  return (
    <div className={STYLES.shell}>
      <DashboardTopbar
        userId={session.userId ?? ""}
        username={username}
        avatar={session.avatar ?? null}
        guild={{ name: guild?.name ?? "Server", iconUrl, initial }}
      />
      <div className={STYLES.page}>
        <aside className={STYLES.sidebar}>
          <GuildNav guildId={guildId} />
        </aside>
        <main className={STYLES.main}>
          <div className={STYLES.mainInner}>{children}</div>
        </main>
      </div>
    </div>
  );
}
