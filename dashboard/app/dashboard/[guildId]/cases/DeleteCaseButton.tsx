"use client";

import { useTransition } from "react";
import { deleteCase } from "./actions";

const STYLES = {
  button:
    "cursor-pointer rounded px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400",
};

export default function DeleteCaseButton({
  guildId,
  caseId,
}: {
  guildId: string;
  caseId: number;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => deleteCase(guildId, caseId));
  }

  return (
    <button onClick={handleClick} disabled={pending} className={STYLES.button}>
      {pending ? "…" : "Delete"}
    </button>
  );
}
