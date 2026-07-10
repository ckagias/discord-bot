"use client";

import { useEffect, useRef, useState } from "react";

const STYLES = {
  wrapper: "relative",
  trigger:
    "flex cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-light)]",
  avatar: "h-6 w-6 shrink-0 rounded-full object-cover",
  avatarFallback:
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-semibold text-[var(--bg-dark)]",
  username: "max-w-32 truncate",
  menu:
    "absolute right-0 top-[calc(100%+0.5rem)] z-10 w-48 rounded-xl border border-[var(--border-muted)] bg-[var(--bg)] py-1.5 shadow-lg",
  menuItem:
    "block w-full cursor-pointer px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--bg-light)]",
  menuItemMuted:
    "block w-full cursor-pointer px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--bg-light)]",
};

function avatarUrl(userId: string, avatar: string | null): string | null {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`;
}

export default function AccountMenu({
  userId,
  username,
  avatar,
}: {
  userId: string;
  username: string;
  avatar: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const iconUrl = avatarUrl(userId, avatar);
  const initial = username.charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSwitchAccount() {
    await fetch("/api/auth/logout", { method: "POST", redirect: "manual" });
    window.location.href = "/api/auth/login?switch=1";
  }

  return (
    <div className={STYLES.wrapper} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={STYLES.trigger}
      >
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" className={STYLES.avatar} />
        ) : (
          <span className={STYLES.avatarFallback}>{initial}</span>
        )}
        <span className={STYLES.username}>{username}</span>
      </button>
      {open && (
        <div className={STYLES.menu}>
          <button
            type="button"
            onClick={handleSwitchAccount}
            className={STYLES.menuItem}
          >
            Switch account
          </button>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className={STYLES.menuItemMuted}>
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
