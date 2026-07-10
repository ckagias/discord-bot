import Link from "next/link";
import AccountMenu from "@/components/AccountMenu";

const STYLES = {
  topbar:
    "flex shrink-0 items-center justify-between border-b border-[var(--border-muted)] px-6 py-2.5",
  topbarLeft: "flex items-center gap-3",
  backLink:
    "flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]",
  backIcon: "h-3.5 w-3.5",
  divider: "h-5 w-px bg-[var(--border-muted)]",
  title: "text-sm font-semibold text-[var(--text)]",
  guildHeader: "flex items-center gap-2.5",
  guildIcon: "h-7 w-7 shrink-0 rounded-full object-cover",
  guildIconFallback:
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-semibold text-[var(--bg-dark)]",
  guildName: "truncate text-sm font-semibold text-[var(--text)]",
};

interface GuildContext {
  name: string;
  iconUrl: string | null;
  initial: string;
}

interface Props {
  userId: string;
  username: string;
  avatar: string | null;
  guild?: GuildContext;
}

export default function DashboardTopbar({ userId, username, avatar, guild }: Props) {
  return (
    <header className={STYLES.topbar}>
      <div className={STYLES.topbarLeft}>
        {guild ? (
          <Link href="/dashboard" className={STYLES.backLink}>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={STYLES.backIcon}
            >
              <path d="M12.5 15 7.5 10l5-5" />
            </svg>
            All servers
          </Link>
        ) : (
          <span className={STYLES.title}>Your Servers</span>
        )}
        {guild && (
          <>
            <div className={STYLES.divider} />
            <div className={STYLES.guildHeader}>
              {guild.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={guild.iconUrl} alt="" className={STYLES.guildIcon} />
              ) : (
                <span className={STYLES.guildIconFallback}>{guild.initial}</span>
              )}
              <span className={STYLES.guildName}>{guild.name}</span>
            </div>
          </>
        )}
      </div>
      <AccountMenu userId={userId} username={username} avatar={avatar} />
    </header>
  );
}
