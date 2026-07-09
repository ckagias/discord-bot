"use client";

import { useState, useTransition } from "react";
import { approveSuggestion, denySuggestion, implementSuggestion, deleteSuggestion } from "./actions";

const STYLES = {
  btn: (variant: "success" | "danger" | "neutral") =>
    [
      "cursor-pointer rounded px-2 py-1 text-xs font-medium disabled:opacity-40 transition-colors",
      variant === "success"
        ? "text-zinc-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950/40 dark:hover:text-green-400"
        : variant === "danger"
        ? "text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
    ].join(" "),
  error: "mt-1 text-xs text-red-500 dark:text-red-400",
  wrap: "flex flex-col items-end",
  row: "flex items-center gap-1",
};

function ActionButton({
  label,
  variant,
  onRun,
}: {
  label: string;
  variant: "success" | "danger" | "neutral";
  onRun: () => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await onRun();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={STYLES.wrap}>
      <button onClick={handleClick} disabled={pending} className={STYLES.btn(variant)}>
        {pending ? "…" : label}
      </button>
      {error && <p className={STYLES.error}>{error}</p>}
    </div>
  );
}

export function SuggestionReviewActions({
  guildId,
  messageId,
}: {
  guildId: string;
  messageId: string;
}) {
  return (
    <div className={STYLES.row}>
      <ActionButton label="Approve" variant="success" onRun={() => approveSuggestion(guildId, messageId)} />
      <ActionButton label="Deny" variant="danger" onRun={() => denySuggestion(guildId, messageId)} />
      <ActionButton label="Implement" variant="neutral" onRun={() => implementSuggestion(guildId, messageId)} />
      <ActionButton label="Delete" variant="danger" onRun={() => deleteSuggestion(guildId, messageId)} />
    </div>
  );
}

export function DeleteSuggestionButton({
  guildId,
  messageId,
}: {
  guildId: string;
  messageId: string;
}) {
  return <ActionButton label="Delete" variant="danger" onRun={() => deleteSuggestion(guildId, messageId)} />;
}
