"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STYLES = {
  nav: "flex flex-col gap-4",
  group: "flex flex-col gap-0.5",
  groupLabel:
    "flex items-center gap-1.5 px-1 pb-1.5 text-[0.6875rem] font-semibold tracking-[0.08em] text-[var(--text-muted)]/70 uppercase",
  groupIcon: "h-3.5 w-3.5 shrink-0",
  link: (active: boolean) =>
    [
      "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-[var(--primary)]/10 text-[var(--primary)]"
        : "text-[var(--text-muted)] hover:bg-[var(--bg-light)] hover:text-[var(--text)]",
    ].join(" "),
};

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3.5" width="14" height="4.5" rx="1.2" />
      <rect x="3" y="12" width="14" height="4.5" rx="1.2" />
      <circle cx="6" cy="5.75" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="6" cy="14.25" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ModerationIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 2.5 16 4.75v4.5c0 4-2.6 6.7-6 8.25-3.4-1.55-6-4.25-6-8.25v-4.5L10 2.5Z" />
    </svg>
  );
}

function CommunityIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="7" cy="7" r="2.5" />
      <path d="M2.5 16c0-2.6 2-4.5 4.5-4.5s4.5 1.9 4.5 4.5" />
      <circle cx="14.5" cy="6.5" r="2" />
      <path d="M12.5 11.6c1.9.4 3.5 1.9 3.9 4.4" />
    </svg>
  );
}

function EconomyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v7M12.3 8.2c0-.9-1-1.7-2.3-1.7s-2.3.7-2.3 1.6c0 2.2 4.6 1 4.6 3.2 0 .9-1 1.6-2.3 1.6s-2.3-.7-2.3-1.6" />
    </svg>
  );
}

const GROUPS = [
  {
    label: "Server",
    icon: ServerIcon,
    sections: [
      { slug: "",          label: "Overview" },
      { slug: "welcome",   label: "Welcome & Farewell" },
      { slug: "birthdays", label: "Birthdays" },
    ],
  },
  {
    label: "Moderation",
    icon: ModerationIcon,
    sections: [
      { slug: "moderation",  label: "Moderation" },
      { slug: "automod",     label: "Auto-Mod" },
      { slug: "anti-raid",   label: "Anti-Raid" },
      { slug: "thresholds",  label: "Warn Thresholds" },
      { slug: "warnings",    label: "Moderation Logs" },
    ],
  },
  {
    label: "Community",
    icon: CommunityIcon,
    sections: [
      { slug: "leveling",       label: "Leveling" },
      { slug: "starboard",      label: "Starboard" },
      { slug: "reaction-roles", label: "Reaction Roles" },
      { slug: "triggers",       label: "Triggers" },
      { slug: "tickets",        label: "Tickets" },
      { slug: "tempvc",         label: "Temp Voice Channels" },
      { slug: "giveaways",      label: "Giveaways" },
      { slug: "suggestions",    label: "Suggestions" },
    ],
  },
  {
    label: "Economy",
    icon: EconomyIcon,
    sections: [
      { slug: "economy", label: "Economy" },
      { slug: "shop",    label: "Shop" },
    ],
  },
];

export default function GuildNav({ guildId }: { guildId: string }) {
  const pathname = usePathname();

  return (
    <nav className={STYLES.nav}>
      {GROUPS.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.label} className={STYLES.group}>
            <span className={STYLES.groupLabel}>
              <GroupIcon className={STYLES.groupIcon} />
              {group.label}
            </span>
            {group.sections.map((section) => {
              const href = section.slug
                ? `/dashboard/${guildId}/${section.slug}`
                : `/dashboard/${guildId}`;
              const active = section.slug ? pathname?.startsWith(href) : pathname === href;
              return (
                <Link key={section.slug} href={href} className={STYLES.link(!!active)}>
                  {section.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
