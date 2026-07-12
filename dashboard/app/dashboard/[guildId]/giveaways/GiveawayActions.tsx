"use client";

import { useState, useTransition } from "react";
import { endGiveaway, rerollGiveaway, deleteGiveaway } from "./actions";

const STYLES = {
  btn: (variant: "danger" | "neutral") =>
    [
      "cursor-pointer rounded px-2 py-1 text-xs font-medium disabled:opacity-40 transition-colors",
      variant === "danger"
        ? "text-[var(--text-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
        : "text-[var(--text-muted)] hover:bg-[var(--bg-light)] hover:text-[var(--text)]",
    ].join(" "),
  error: "mt-1 text-xs text-[var(--danger)]",
  wrap: "flex flex-col items-end",
  iconBtn:
    "cursor-pointer rounded p-1 text-[var(--danger)]/70 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:opacity-40 transition-colors",
  icon: "h-4 w-4",
};

export function EndGiveawayButton({
  guildId,
  messageId,
}: {
  guildId: string;
  messageId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await endGiveaway(guildId, messageId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={STYLES.wrap}>
      <button onClick={handleClick} disabled={pending} className={STYLES.btn("danger")}>
        {pending ? "…" : "End"}
      </button>
      {error && <p className={STYLES.error}>{error}</p>}
    </div>
  );
}

export function RerollGiveawayButton({
  guildId,
  messageId,
}: {
  guildId: string;
  messageId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await rerollGiveaway(guildId, messageId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={STYLES.wrap}>
      <button onClick={handleClick} disabled={pending} className={STYLES.btn("neutral")}>
        {pending ? "…" : "Reroll"}
      </button>
      {error && <p className={STYLES.error}>{error}</p>}
    </div>
  );
}

export function DeleteGiveawayButton({
  guildId,
  messageId,
}: {
  guildId: string;
  messageId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await deleteGiveaway(guildId, messageId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={STYLES.wrap}>
      <button onClick={handleClick} disabled={pending} className={STYLES.iconBtn} aria-label="Delete giveaway" title="Delete">
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
      {error && <p className={STYLES.error}>{error}</p>}
    </div>
  );
}
