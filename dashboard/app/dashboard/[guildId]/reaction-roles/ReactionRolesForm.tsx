"use client";

import SettingsCard from "@/components/SettingsCard";
import AddIconButton from "@/components/AddIconButton";
import RemoveIconButton from "@/components/RemoveIconButton";
import { useRowListForm } from "@/lib/useRowListForm";
import { updateReactionRoles } from "./actions";
import type { ReactionRoleDoc } from "@/lib/models/ReactionRole";
import type { DiscordRole } from "@/lib/discord";

interface Row extends Omit<ReactionRoleDoc, "guildId"> {
  key: number;
}

const STYLES = {
  form: "flex flex-col gap-6 max-w-xl",
  footer: "flex items-center gap-3 -mt-3",
  submitButton:
    "cursor-pointer self-start rounded-[8px] bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--border)] disabled:text-[var(--text-muted)] disabled:opacity-100",
  savedText: "text-sm text-[var(--success)]",
  errorText: "text-sm text-[var(--danger)]",
  row: "flex items-end gap-3 flex-wrap",
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
  note: "text-xs text-[var(--text-muted)]",
  rowsScroll: "flex max-h-[33rem] flex-col gap-4 overflow-y-auto overflow-x-hidden pr-3 -mr-3",
};

export default function ReactionRolesForm({
  guildId,
  initial,
  roles,
}: {
  guildId: string;
  initial: Omit<ReactionRoleDoc, "guildId">[];
  roles: DiscordRole[];
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
    makeRow: (key) => ({ key, messageId: "", emoji: "", roleId: roles[0]?.id ?? "" }),
    submit: (rows) => {
      const fd = new FormData();
      fd.set("reactionRoles", JSON.stringify(rows.map(({ key: _key, ...rr }) => rr)));
      return updateReactionRoles(guildId, fd);
    },
  });

  return (
    <form onSubmit={handleSubmit} className={STYLES.form}>
      <SettingsCard
        title="Reaction Roles"
        description="Assign a role when a member reacts to a message with a specific emoji."
        headerAction={
          <AddIconButton
            onClick={addRow}
            label="Add reaction role"
            className={STYLES.addIconButton}
            iconClassName={STYLES.addIcon}
          />
        }
      >
        <p className={STYLES.note}>
          Paste a message ID, enter the emoji (unicode or <code>&lt;:name:id&gt;</code>), and pick a role. Takes effect immediately. Use <code>/reactionrole add</code> in Discord to auto-add the bot&apos;s reaction.
        </p>

        {rows.length === 0 ? (
          <p className={STYLES.empty}>No reaction roles configured. Add one below.</p>
        ) : (
          <div ref={rowsScrollRef} className={STYLES.rowsScroll}>
            {rows.map((row) => (
              <div key={row.key} className={STYLES.row}>
                <div className={STYLES.rowField}>
                  <label className={STYLES.label}>Message ID</label>
                  <input
                    type="text"
                    value={row.messageId}
                    placeholder="123456789012345678"
                    onChange={(e) => updateRow(row.key, { messageId: e.target.value })}
                    className={STYLES.input}
                  />
                </div>

                <div className={STYLES.rowField}>
                  <label className={STYLES.label}>Emoji</label>
                  <input
                    type="text"
                    value={row.emoji}
                    placeholder="👍 or <:name:id>"
                    onChange={(e) => updateRow(row.key, { emoji: e.target.value })}
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

                <RemoveIconButton
                  onClick={() => removeRow(row.key)}
                  label="Remove reaction role"
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
