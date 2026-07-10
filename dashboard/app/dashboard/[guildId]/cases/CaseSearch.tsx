"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

const STYLES = {
  wrapper: "mb-6 flex gap-2",
  input:
    "flex-1 rounded-lg border border-[var(--border-muted)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50",
  button:
    "cursor-pointer rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50",
  clearButton:
    "cursor-pointer rounded-lg border border-[var(--border-muted)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-light)]",
};

export default function CaseSearch({ defaultValue, order }: { defaultValue: string; order: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const userId = (e.currentTarget.elements.namedItem("userId") as HTMLInputElement).value.trim();
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (order && order !== "desc") params.set("order", order);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function handleClear() {
    const params = new URLSearchParams();
    if (order && order !== "desc") params.set("order", order);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <form onSubmit={handleSubmit} className={STYLES.wrapper}>
      <input
        name="userId"
        type="text"
        defaultValue={defaultValue}
        placeholder="Filter by user ID..."
        className={STYLES.input}
      />
      <button type="submit" disabled={pending} className={STYLES.button}>
        Search
      </button>
      {defaultValue && (
        <button type="button" onClick={handleClear} className={STYLES.clearButton}>
          Clear
        </button>
      )}
    </form>
  );
}
