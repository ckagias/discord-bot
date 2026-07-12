"use client";

import { useEffect, useState, useTransition } from "react";
import SettingsCard from "@/components/SettingsCard";

const STYLES = {
  footer: "flex items-center gap-3",
  submitButton:
    "cursor-pointer self-start rounded-[8px] bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--border)] disabled:text-[var(--text-muted)] disabled:opacity-100",
  savedText: "text-sm text-[var(--success)]",
  errorText: "text-sm text-[var(--danger)]",
};

interface Props {
  action: (formData: FormData) => Promise<void>;
  title: string;
  description?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  formClassName?: string;
  className?: string;
  bodyClassName?: string;
}

// Fuses a <form> with a single SettingsCard so the Save button lives inside the card's own flex layout.
export default function SettingsCardForm({
  action,
  title,
  description,
  headerAction,
  children,
  formClassName,
  className,
  bodyClassName,
}: Props) {
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("idle");
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await action(fd);
        setStatus("saved");
        setDirty(false);
      } catch (err) {
        console.error(err);
        setStatus("error");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => {
        setDirty(true);
        setStatus("idle");
      }}
      className={formClassName}
    >
      <SettingsCard
        title={title}
        description={description}
        headerAction={headerAction}
        className={className}
        bodyClassName={bodyClassName}
      >
        {children}
        <div className={STYLES.footer}>
          <button type="submit" disabled={isPending || !dirty} className={STYLES.submitButton}>
            {isPending ? "Saving..." : "Save changes"}
          </button>
          {status === "saved" && <span className={STYLES.savedText}>Saved</span>}
          {status === "error" && (
            <span className={STYLES.errorText}>Failed to save — try again</span>
          )}
        </div>
      </SettingsCard>
    </form>
  );
}
