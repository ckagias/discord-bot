"use client";

import { useTransition } from "react";
import { deleteWarn } from "./actions";

const STYLES = {
  button:
    "cursor-pointer rounded p-1 text-[var(--danger)]/70 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:opacity-40 transition-colors",
  icon: "h-4 w-4",
};

export default function DeleteWarnButton({
  guildId,
  warnId,
}: {
  guildId: string;
  warnId: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => deleteWarn(guildId, warnId));
  }

  return (
    <button onClick={handleClick} disabled={pending} className={STYLES.button} aria-label="Delete warning" title="Delete">
      {pending ? (
        "…"
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={STYLES.icon}>
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      )}
    </button>
  );
}
