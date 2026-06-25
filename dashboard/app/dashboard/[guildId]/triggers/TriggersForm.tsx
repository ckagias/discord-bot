"use client";

import { useEffect, useState, useTransition } from "react";
import SettingsCard from "@/components/SettingsCard";
import { updateTriggers } from "./actions";
import type { TriggerDoc } from "@/lib/models/Trigger";

interface Row extends Omit<TriggerDoc, "guildId"> {
  key: number;
}

const STYLES = {
  form: "flex flex-col gap-6 max-w-xl",
  footer: "flex items-center gap-3",
  submitButton:
    "cursor-pointer self-start rounded-full bg-[#5865F2] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600",
  savedText: "text-sm text-green-600 dark:text-green-400",
  errorText: "text-sm text-red-600 dark:text-red-400",
  row: "flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800",
  rowHeader: "flex items-center justify-between gap-3",
  rowField: "flex flex-col gap-1.5",
  label: "text-sm font-medium text-black dark:text-zinc-50",
  input:
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none transition-colors focus:border-[#5865F2] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50",
  textarea:
    "w-full min-h-20 resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none transition-colors focus:border-[#5865F2] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50",
  removeButton:
    "cursor-pointer shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:border-red-300 hover:text-red-500 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:text-red-400",
  addButton:
    "cursor-pointer self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 transition-colors hover:border-[#5865F2] hover:text-[#5865F2] dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-[#5865F2] dark:hover:text-[#5865F2]",
  empty: "text-sm text-zinc-500 dark:text-zinc-400",
};

export default function TriggersForm({
  guildId,
  initial,
}: {
  guildId: string;
  initial: Omit<TriggerDoc, "guildId">[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((t, i) => ({ ...t, key: i }))
  );
  const [nextKey, setNextKey] = useState(initial.length);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function mark() {
    setDirty(true);
    setStatus("idle");
  }

  function addRow() {
    setRows((prev) => [...prev, { key: nextKey, trigger: "", response: "" }]);
    setNextKey((k) => k + 1);
    mark();
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    mark();
  }

  function updateRow(key: number, patch: Partial<Omit<Row, "key">>) {
    setRows((prev) =>
      prev.map((r) => (r.key !== key ? r : { ...r, ...patch }))
    );
    mark();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("idle");
    const payload = rows.map(({ key: _key, ...t }) => t);
    const fd = new FormData();
    fd.set("triggers", JSON.stringify(payload));

    startTransition(async () => {
      try {
        await updateTriggers(guildId, fd);
        setStatus("saved");
        setDirty(false);
      } catch (err) {
        console.error(err);
        setStatus("error");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={STYLES.form}>
      <SettingsCard
        title="Keyword Triggers"
        description="When a message contains a keyword, the bot replies with the configured response. Triggers are case-insensitive and match whole words."
      >
        {rows.length === 0 ? (
          <p className={STYLES.empty}>No triggers configured. Add one below.</p>
        ) : (
          rows.map((row) => (
            <div key={row.key} className={STYLES.row}>
              <div className={STYLES.rowHeader}>
                <span className={STYLES.label}>Trigger</span>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className={STYLES.removeButton}
                >
                  Remove
                </button>
              </div>
              <div className={STYLES.rowField}>
                <label className={STYLES.label}>Keyword</label>
                <input
                  type="text"
                  value={row.trigger}
                  placeholder="e.g. hello"
                  onChange={(e) => updateRow(row.key, { trigger: e.target.value })}
                  className={STYLES.input}
                />
              </div>
              <div className={STYLES.rowField}>
                <label className={STYLES.label}>Response</label>
                <textarea
                  value={row.response}
                  placeholder="Bot's reply when the keyword is detected."
                  onChange={(e) => updateRow(row.key, { response: e.target.value })}
                  className={STYLES.textarea}
                />
              </div>
            </div>
          ))
        )}

        <button type="button" onClick={addRow} className={STYLES.addButton}>
          + Add trigger
        </button>
      </SettingsCard>

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
