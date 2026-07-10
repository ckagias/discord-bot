"use client";

import { useEffect } from "react";

const STYLES = {
  page: "flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center",
  heading: "text-xl font-semibold text-[var(--text)]",
  message: "max-w-md text-sm text-[var(--text-muted)]",
  button:
    "mt-2 rounded-lg bg-[var(--bg-light)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)]",
};

export default function GuildError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <div className={STYLES.page}>
      <h2 className={STYLES.heading}>Something went wrong</h2>
      <p className={STYLES.message}>{error.message || "An unexpected error occurred."}</p>
      <button onClick={reset} className={STYLES.button}>
        Try again
      </button>
    </div>
  );
}
