"use client";

import { useState, useTransition } from "react";
import { lockServer, unlockServer } from "./actions";

const STYLES = {
  wrap: "flex flex-col items-start gap-1",
  btn: (variant: "danger" | "success") =>
    [
      "cursor-pointer self-start rounded-[8px] px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
      variant === "danger"
        ? "bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20"
        : "bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20",
    ].join(" "),
  error: "text-sm text-[var(--danger)]",
};

export default function LockdownActions({
  guildId,
  locked,
}: {
  guildId: string;
  locked: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const action = locked ? unlockServer : lockServer;
      const result = await action(guildId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={STYLES.wrap}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={STYLES.btn(locked ? "success" : "danger")}
      >
        {pending ? "Working..." : locked ? "Unlock server" : "Lock server"}
      </button>
      {error && <p className={STYLES.error}>{error}</p>}
    </div>
  );
}
