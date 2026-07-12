"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
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

export default function UserIdSearch({
  defaultValue,
  order,
  paramName = "userId",
  orderParamName = "order",
}: {
  defaultValue: string;
  order: string;
  paramName?: string;
  orderParamName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const userId = (e.currentTarget.elements.namedItem(paramName) as HTMLInputElement).value.trim();
    const params = new URLSearchParams(searchParams.toString());
    if (userId) params.set(paramName, userId);
    else params.delete(paramName);
    if (order && order !== "desc") params.set(orderParamName, order);
    else params.delete(orderParamName);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function handleClear() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(paramName);
    if (order && order !== "desc") params.set(orderParamName, order);
    else params.delete(orderParamName);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <form onSubmit={handleSubmit} className={STYLES.wrapper}>
      <input
        name={paramName}
        type="text"
        defaultValue={defaultValue}
        placeholder="Filter by username or user ID..."
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
