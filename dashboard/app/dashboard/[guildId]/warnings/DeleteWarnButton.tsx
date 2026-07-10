"use client";

import { useTransition } from "react";
import { deleteWarn } from "./actions";

const STYLES = {
  button:
    "cursor-pointer rounded px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:opacity-40",
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
    <button onClick={handleClick} disabled={pending} className={STYLES.button}>
      {pending ? "…" : "Delete"}
    </button>
  );
}
