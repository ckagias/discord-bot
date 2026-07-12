"use client";

import SettingsCard from "@/components/SettingsCard";
import { ChannelField, ToggleField } from "@/components/Field";
import AddIconButton from "@/components/AddIconButton";
import RemoveIconButton from "@/components/RemoveIconButton";
import { useRowListForm } from "@/lib/useRowListForm";
import { updateLevelingSettings } from "./actions";
import type { LevelRole } from "@/lib/models/Guild";
import type { DiscordChannel, DiscordRole } from "@/lib/discord";

interface Row extends LevelRole {
  key: number;
}

const STYLES = {
  form: "flex flex-col lg:h-full",
  card: "flex flex-col rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-6 py-6 lg:h-full shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  body: "mt-6 flex flex-1 min-h-0 flex-col gap-6",
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
    "cursor-pointer flex h-9 w-8 shrink-0 items-center justify-center rounded p-1 text-[var(--danger)]/70 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:opacity-40 transition-colors",
  removeIcon: "h-4 w-4",
  addIconButton:
    "cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]",
  addIcon: "h-4 w-4",
  empty: "text-sm text-[var(--text-muted)]",
  emptyWrap: "flex flex-1 min-h-0 items-center justify-center",
  rowsScroll: "flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-3 -mr-3",
  divider: "border-t border-[var(--border-muted)]",
  sectionHeader: "flex items-center justify-between gap-3",
  sectionTitle: "text-sm font-semibold text-[var(--text)]",
};

export default function LevelingSettingsForm({
  guildId,
  levelingEnabled,
  levelUpChannelId,
  textChannels,
  initialLevelRoles,
  roles,
}: {
  guildId: string;
  levelingEnabled: boolean;
  levelUpChannelId: string | null;
  textChannels: DiscordChannel[];
  initialLevelRoles: LevelRole[];
  roles: DiscordRole[];
}) {
  const {
    rows,
    dirty,
    mark,
    isPending,
    status,
    rowsScrollRef,
    addRow,
    removeRow,
    updateRow,
    handleSubmit,
  } = useRowListForm<Row>({
    initial: initialLevelRoles,
    makeRow: (key, prev) => {
      const maxLevel = prev.reduce((max, r) => Math.max(max, r.level), 0);
      return { key, level: maxLevel + 1, roleId: roles[0]?.id ?? "" };
    },
    submit: (rows, form) => {
      const fd = new FormData(form);
      fd.set("levelRoles", JSON.stringify(rows.map(({ key: _key, ...lr }) => lr)));
      return updateLevelingSettings(guildId, fd);
    },
  });

  return (
    <form onSubmit={handleSubmit} onChange={mark} className={STYLES.form}>
      <SettingsCard
        title="Settings"
        description="Configure the XP leveling system for this server."
        className={STYLES.card}
        bodyClassName={STYLES.body}
      >
        <ToggleField
          label="Enable leveling"
          name="levelingEnabled"
          defaultChecked={levelingEnabled}
        />
        <ChannelField
          label="Level-up channel"
          description="Where level-up announcements are posted. Leave as None to post in the channel where the member chatted."
          name="levelUpChannelId"
          defaultValue={levelUpChannelId}
          channels={textChannels}
        />

        <div className={STYLES.divider} />

        <div className={STYLES.sectionHeader}>
          <span className={STYLES.sectionTitle}>Level Roles</span>
          <AddIconButton
            onClick={addRow}
            label="Add level role"
            className={STYLES.addIconButton}
            iconClassName={STYLES.addIcon}
          />
        </div>

        {rows.length === 0 ? (
          <div className={STYLES.emptyWrap}>
            <p className={STYLES.empty}>No level roles configured. Add one below.</p>
          </div>
        ) : (
          <div ref={rowsScrollRef} className={STYLES.rowsScroll}>
            {rows.map((row) => (
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

                <RemoveIconButton
                  onClick={() => removeRow(row.key)}
                  label="Remove level role"
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
