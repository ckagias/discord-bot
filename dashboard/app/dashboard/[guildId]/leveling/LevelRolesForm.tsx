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
    "cursor-pointer self-start rounded-[8px] bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--border)] disabled:text-[var(--text-muted)] disabled:opacity-100",
  savedText: "text-sm text-[var(--success)]",
  errorText: "text-sm text-[var(--danger)]",
  row: "flex items-end gap-3",
  rowField: "flex flex-col gap-1.5 flex-1 min-w-0",
  label: "text-sm font-medium text-[var(--text)]",
  input:
    "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]",
  select:
    "cursor-pointer w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg)] bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%207.5%2010%2012.5%2015%207.5%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:12px] bg-[right_1rem_center] pl-3 pr-9 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]",
  removeButton:
    "cursor-pointer shrink-0 rounded-lg border border-[var(--border-muted)] px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]",
  addButton:
    "cursor-pointer self-start rounded-lg border border-dashed border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]",
  empty: "text-sm text-[var(--text-muted)]",
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
        description="Roles stack: members keep every level role they've earned."
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
