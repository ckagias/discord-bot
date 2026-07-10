"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STYLES = {
  nav: "flex flex-col gap-1",
  link: (active: boolean) =>
    [
      "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-[#5865F2]/10 text-[#5865F2] dark:bg-[#5865F2]/15"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
    ].join(" "),
};

const SECTIONS = [
  { slug: "general",        label: "General" },
  { slug: "welcome",        label: "Welcome & Farewell" },
  { slug: "birthdays",      label: "Birthdays" },
  { slug: "moderation",     label: "Moderation" },
  { slug: "automod",        label: "Auto-Mod" },
  { slug: "anti-raid",      label: "Anti-Raid" },
  { slug: "thresholds",     label: "Warn Thresholds" },
  { slug: "warnings",       label: "Warnings" },
  { slug: "leveling",       label: "Leveling" },
  { slug: "starboard",      label: "Starboard" },
  { slug: "reaction-roles", label: "Reaction Roles" },
  { slug: "triggers",       label: "Triggers" },
  { slug: "cases",          label: "Case Log" },
  { slug: "economy",        label: "Economy" },
  { slug: "shop",           label: "Shop" },
  { slug: "tickets",        label: "Tickets" },
  { slug: "tempvc",         label: "Temp Voice Channels" },
  { slug: "giveaways",     label: "Giveaways" },
  { slug: "suggestions",   label: "Suggestions" },
];

export default function GuildNav({ guildId }: { guildId: string }) {
  const pathname = usePathname();

  return (
    <nav className={STYLES.nav}>
      {SECTIONS.map((section) => {
        const href = `/dashboard/${guildId}/${section.slug}`;
        const active = pathname?.startsWith(href);
        return (
          <Link key={section.slug} href={href} className={STYLES.link(!!active)}>
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
