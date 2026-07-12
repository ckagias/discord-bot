"use client";

import SettingsCard from "@/components/SettingsCard";
import AddIconButton from "@/components/AddIconButton";
import RemoveIconButton from "@/components/RemoveIconButton";
import { useRowListForm } from "@/lib/useRowListForm";
import { updateTriggers } from "./actions";
import type { TriggerDoc } from "@/lib/models/Trigger";

interface Row extends Omit<TriggerDoc, "guildId"> {
  key: number;
}

const STYLES = {
  form: "flex flex-col gap-6 max-w-4xl",
  footer: "flex items-center gap-3 -mt-3",
  submitButton:
    "cursor-pointer self-start rounded-[8px] bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--border)] disabled:text-[var(--text-muted)] disabled:opacity-100",
  savedText: "text-sm text-[var(--success)]",
  errorText: "text-sm text-[var(--danger)]",
  row: "flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-light)] p-4",
  rowHeader: "flex items-center justify-between gap-3",
  rowField: "flex flex-col gap-1.5",
  label: "text-sm font-medium text-[var(--text)]",
  input:
    "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]",
  textarea:
    "w-full min-h-20 resize-y rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]",
  removeButton:
    "cursor-pointer shrink-0 rounded p-1 text-[var(--danger)]/70 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:opacity-40 transition-colors",
  removeIcon: "h-4 w-4",
  addIconButton:
    "cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]",
  addIcon: "h-4 w-4",
  empty: "text-sm text-[var(--text-muted)]",
  rowsScroll:
    "grid max-h-[36.5rem] grid-cols-1 gap-4 overflow-y-auto overflow-x-hidden pr-3 -mr-3 lg:grid-cols-2 lg:items-start",
};

export default function TriggersForm({
  guildId,
  initial,
}: {
  guildId: string;
  initial: Omit<TriggerDoc, "guildId">[];
}) {
  const {
    rows,
    dirty,
    isPending,
    status,
    rowsScrollRef,
    addRow,
    removeRow,
    updateRow,
    handleSubmit,
  } = useRowListForm<Row>({
    initial,
    makeRow: (key) => ({ key, trigger: "", response: "" }),
    submit: (rows) => {
      const fd = new FormData();
      fd.set("triggers", JSON.stringify(rows.map(({ key: _key, ...t }) => t)));
      return updateTriggers(guildId, fd);
    },
  });

  return (
    <form onSubmit={handleSubmit} className={STYLES.form}>
      <SettingsCard
        title="Keyword Triggers"
        description="Case-insensitive, whole-word matches only."
        headerAction={
          <AddIconButton
            onClick={addRow}
            label="Add trigger"
            className={STYLES.addIconButton}
            iconClassName={STYLES.addIcon}
          />
        }
      >
        {rows.length === 0 ? (
          <p className={STYLES.empty}>No triggers configured. Add one below.</p>
        ) : (
          <div ref={rowsScrollRef} className={STYLES.rowsScroll}>
            {rows.map((row) => (
              <div key={row.key} className={STYLES.row}>
                <div className={STYLES.rowHeader}>
                  <span className={STYLES.label}>Trigger</span>
                  <RemoveIconButton
                    onClick={() => removeRow(row.key)}
                    label="Remove trigger"
                    className={STYLES.removeButton}
                    iconClassName={STYLES.removeIcon}
                  />
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
