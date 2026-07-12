"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const STYLES = {
  form: "flex flex-col gap-6 max-w-xl",
  footer: "flex items-center gap-3",
  submitButton:
    "cursor-pointer self-start rounded-[8px] bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-[var(--bg-dark)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--border)] disabled:text-[var(--text-muted)] disabled:opacity-100",
  savedText: "text-sm text-[var(--success)]",
  errorText: "text-sm text-[var(--danger)]",
};

interface Props {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function SectionForm({ action, children, className, contentClassName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function handleSubmit(formData: FormData) {
    setStatus("idle");
    startTransition(async () => {
      try {
        await action(formData);
        setStatus("saved");
        setDirty(false);
        router.refresh();
      } catch (err) {
        console.error(err);
        setStatus("error");
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      onChange={() => {
        setDirty(true);
        setStatus("idle");
      }}
      className={className ?? STYLES.form}
    >
      <div className={contentClassName ?? "flex flex-col gap-6"}>{children}</div>
      <div className={STYLES.footer}>
        <button
          type="submit"
          disabled={isPending || !dirty}
          className={STYLES.submitButton}
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
        {status === "saved" && <span className={STYLES.savedText}>Saved</span>}
        {status === "error" && (
          <span className={STYLES.errorText}>Failed to save — try again</span>
        )}
      </div>
    </form>
  );
}
