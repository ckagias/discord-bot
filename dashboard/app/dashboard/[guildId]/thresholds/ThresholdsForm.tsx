"use client";

import SettingsCard from "@/components/SettingsCard";
import AddIconButton from "@/components/AddIconButton";
import RemoveIconButton from "@/components/RemoveIconButton";
import { useRowListForm } from "@/lib/useRowListForm";
import { updateWarnThresholds } from "./actions";
import type { WarnThreshold } from "@/lib/models/Guild";

type Action = "timeout" | "kick" | "ban";

interface Row extends WarnThreshold {
  key: number;
}

const ACTION_OPTIONS: { value: Action; label: string }[] = [
  { value: "timeout", label: "Timeout" },
  { value: "kick",    label: "Kick" },
  { value: "ban",     label: "Ban" },
];

const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 60,      label: "1 minute" },
  { value: 300,     label: "5 minutes" },
  { value: 600,     label: "10 minutes" },
  { value: 1800,    label: "30 minutes" },
  { value: 3600,    label: "1 hour" },
  { value: 21600,   label: "6 hours" },
  { value: 86400,   label: "1 day" },
  { value: 604800,  label: "1 week" },
  { value: 2419200, label: "28 days" },
];

const STYLES = {
  form: "flex flex-col gap-6 max-w-xl",
  footer: "flex items-center gap-3 -mt-3",
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
    "cursor-pointer flex h-9 w-8 shrink-0 items-center justify-center rounded p-1 text-[var(--danger)]/70 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:opacity-40 transition-colors",
  removeIcon: "h-4 w-4",
  addIconButton:
    "cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]",
  addIcon: "h-4 w-4",
  empty: "text-sm text-[var(--text-muted)]",
  rowsScroll: "flex max-h-[30rem] flex-col gap-4 overflow-y-auto overflow-x-hidden pr-3 -mr-3",
};

export default function ThresholdsForm({
  guildId,
  initial,
}: {
  guildId: string;
  initial: WarnThreshold[];
}) {
  const {
    rows,
    setRows,
    dirty,
    mark,
    isPending,
    status,
    rowsScrollRef,
    addRow,
    removeRow,
    handleSubmit,
  } = useRowListForm<Row>({
    initial,
    makeRow: (key, prev) => {
      const maxCount = prev.reduce((max, r) => Math.max(max, r.count), 0);
      return { key, count: maxCount + 1, action: "timeout", duration: 300 };
    },
    submit: (rows) => {
      const fd = new FormData();
      fd.set("warnThresholds", JSON.stringify(rows.map(({ key: _key, ...t }) => t)));
      return updateWarnThresholds(guildId, fd);
    },
  });

  function updateRow(key: number, patch: Partial<Omit<Row, "key">>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (next.action !== "timeout") next.duration = null;
        if (next.action === "timeout" && next.duration === null) next.duration = 300;
        return next;
      })
    );
    mark();
  }

  return (
    <form onSubmit={handleSubmit} className={STYLES.form}>
      <SettingsCard
        title="Warning Thresholds"
        description="Each threshold fires once, the moment a member hits that warning count."
        headerAction={
          <AddIconButton
            onClick={addRow}
            label="Add threshold"
            className={STYLES.addIconButton}
            iconClassName={STYLES.addIcon}
          />
        }
      >
        {rows.length === 0 ? (
          <p className={STYLES.empty}>No thresholds configured. Add one below.</p>
        ) : (
          <div ref={rowsScrollRef} className={STYLES.rowsScroll}>
            {rows.map((row) => (
              <div key={row.key} className={STYLES.row}>
                <div className={STYLES.rowField}>
                  <label className={STYLES.label}>Warnings</label>
                  <input
                    type="number"
                    min={1}
                    value={row.count}
                    onChange={(e) =>
                      updateRow(row.key, { count: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className={STYLES.input}
                  />
                </div>

                <div className={STYLES.rowField}>
                  <label className={STYLES.label}>Action</label>
                  <select
                    value={row.action}
                    onChange={(e) => updateRow(row.key, { action: e.target.value as Action })}
                    className={STYLES.select}
                  >
                    {ACTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {row.action === "timeout" && (
                  <div className={STYLES.rowField}>
                    <label className={STYLES.label}>Duration</label>
                    <select
                      value={row.duration ?? 300}
                      onChange={(e) =>
                        updateRow(row.key, { duration: parseInt(e.target.value) })
                      }
                      className={STYLES.select}
                    >
                      {DURATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <RemoveIconButton
                  onClick={() => removeRow(row.key)}
                  label="Remove threshold"
                  className={STYLES.removeButton}
                  iconClassName={STYLES.removeIcon}
                />
              </div>
            ))}
          </div>
        )}

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
      </SettingsCard>
    </form>
  );
}
