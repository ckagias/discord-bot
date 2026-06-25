"use client";

import { useEffect, useState, useTransition } from "react";
import SettingsCard from "@/components/SettingsCard";
import { updateLevelRoles } from "./actions";
import type { LevelRole } from "@/lib/models/Guild";
import type { DiscordRole } from "@/lib/discord";

interface Row extends LevelRole {
  key: number;
}

const STYLES = {
  form: "flex flex-col gap-6",
  footer: "flex items-center gap-3",
  submitButton:
    "cursor-pointer self-start rounded-full bg-[#5865F2] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600",
  savedText: "text-sm text-green-600 dark:text-green-400",
  errorText: "text-sm text-red-600 dark:text-red-400",
  row: "flex items-end gap-3",
  rowField: "flex flex-col gap-1.5 flex-1 min-w-0",
  label: "text-sm font-medium text-black dark:text-zinc-50",
  input:
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none transition-colors focus:border-[#5865F2] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50",
  select:
    "cursor-pointer w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none transition-colors focus:border-[#5865F2] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50",
  removeButton:
    "cursor-pointer shrink-0 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-500 transition-colors hover:border-red-300 hover:text-red-500 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:text-red-400",
  addButton:
    "cursor-pointer self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 transition-colors hover:border-[#5865F2] hover:text-[#5865F2] dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-[#5865F2] dark:hover:text-[#5865F2]",
  empty: "text-sm text-zinc-500 dark:text-zinc-400",
};

export default function LevelRolesForm({
  guildId,
  initial,
  roles,
}: {
  guildId: string;
  initial: LevelRole[];
  roles: DiscordRole[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((lr, i) => ({ ...lr, key: i }))
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
    const defaultRoleId = roles[0]?.id ?? "";
    setRows((prev) => {
      const maxLevel = prev.reduce((max, r) => Math.max(max, r.level), 0);
      return [...prev, { key: nextKey, level: maxLevel + 1, roleId: defaultRoleId }];
    });
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
    const payload = rows.map(({ key: _key, ...lr }) => lr);
    const fd = new FormData();
    fd.set("levelRoles", JSON.stringify(payload));

    startTransition(async () => {
      try {
        await updateLevelRoles(guildId, fd);
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
        title="Level Roles"
        description="Grant a role automatically when a member reaches a specific level. Roles stack — members keep all earned level roles."
      >
        {rows.length === 0 ? (
          <p className={STYLES.empty}>No level roles configured. Add one below.</p>
        ) : (
          rows.map((row) => (
            <div key={row.key} className={STYLES.row}>
              <div className={STYLES.rowField}>
                <label className={STYLES.label}>Level</label>
                <input
                  type="number"
                  min={1}
                  value={row.level}
                  onChange={(e) =>
                    updateRow(row.key, { level: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  className={STYLES.input}
                />
              </div>

              <div className={STYLES.rowField}>
                <label className={STYLES.label}>Role</label>
                <select
                  value={row.roleId}
                  onChange={(e) => updateRow(row.key, { roleId: e.target.value })}
                  className={STYLES.select}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className={STYLES.removeButton}
              >
                Remove
              </button>
            </div>
          ))
        )}

        <button type="button" onClick={addRow} className={STYLES.addButton}>
          + Add level role
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
