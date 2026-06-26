"use client";

import { useState, useTransition } from "react";
import { endGiveaway, rerollGiveaway, deleteGiveaway } from "./actions";

const STYLES = {
  btn: (variant: "danger" | "neutral") =>
    [
      "cursor-pointer rounded px-2 py-1 text-xs font-medium disabled:opacity-40 transition-colors",
      variant === "danger"
        ? "text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
    ].join(" "),
  error: "mt-1 text-xs text-red-500 dark:text-red-400",
  wrap: "flex flex-col items-end",
  row: "flex items-center gap-1",
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
      <button onClick={handleClick} disabled={pending} className={STYLES.btn("danger")}>
        {pending ? "…" : "Delete"}
      </button>
      {error && <p className={STYLES.error}>{error}</p>}
    </div>
  );
}
