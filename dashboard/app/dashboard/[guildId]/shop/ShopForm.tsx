"use client";

import { useState } from "react";
import SettingsCard from "@/components/SettingsCard";
import AddIconButton from "@/components/AddIconButton";
import RemoveIconButton from "@/components/RemoveIconButton";
import { useRowListForm } from "@/lib/useRowListForm";
import { updateShop } from "./actions";
import type { ShopDoc } from "@/lib/models/Shop";
import type { DiscordRole } from "@/lib/discord";

interface Row extends Omit<ShopDoc, "guildId"> {
  key: number;
}

const STYLES = {
  form: "flex flex-col gap-6 max-w-4xl",
  footer: "flex items-center gap-3 -mt-3",
  submitButton:
    "cursor-pointer self-start rounded-[8px] bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--border)] disabled:text-[var(--text-muted)] disabled:opacity-100",
  savedText: "text-sm text-[var(--success)]",
  errorText: "text-sm text-[var(--danger)]",
  row: "@container flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-light)] p-4",
  rowHeader: "flex items-center justify-between gap-3",
  rowTitle: "text-sm font-semibold text-[var(--text)]",
  rowTitlePlaceholder: "italic text-[var(--text-muted)]",
  rowFields: "grid grid-cols-1 gap-3 @sm:grid-cols-2",
  rowFieldFull: "flex flex-col gap-1.5 @sm:col-span-2",
  rowField: "flex flex-col gap-1.5",
  label: "text-sm font-medium text-[var(--text)]",
  input:
    "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]",
  numberInput:
    "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
  select:
    "cursor-pointer w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg)] bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%207.5%2010%2012.5%2015%207.5%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:12px] bg-[right_1rem_center] pl-3 pr-9 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]",
  checkboxRow: "flex items-center gap-2",
  checkbox: "h-4 w-4 cursor-pointer accent-[var(--primary)]",
  checkboxLabel: "text-sm text-[var(--text)]",
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

function blankRow(key: number, firstRoleId: string): Row {
  return {
    key,
    itemId: "",
    name: "",
    description: "",
    price: 100,
    type: "role",
    roleId: firstRoleId,
    emoji: "",
    enabled: true,
  };
}

export default function ShopForm({
  guildId,
  initial,
  roles,
}: {
  guildId: string;
  initial: Omit<ShopDoc, "guildId">[];
  roles: DiscordRole[];
}) {
  const [errorMsg, setErrorMsg] = useState("");
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
    makeRow: (key) => blankRow(key, roles[0]?.id ?? ""),
    submit: async (rows) => {
      setErrorMsg("");
      const payload = rows.map(({ key: _key, ...item }) => ({
        ...item,
        // Send empty itemId as undefined so actions.ts treats it as new
        itemId: item.itemId || undefined,
      }));
      const fd = new FormData();
      fd.set("shop", JSON.stringify(payload));
      try {
        await updateShop(guildId, fd);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
        throw err;
      }
    },
  });

  return (
    <form onSubmit={handleSubmit} className={STYLES.form}>
      <SettingsCard
        title="Shop Items"
        description="Role items grant a Discord role on purchase; badge items add an emoji to /profile."
        headerAction={
          <AddIconButton
            onClick={addRow}
            label="Add item"
            className={STYLES.addIconButton}
            iconClassName={STYLES.addIcon}
          />
        }
      >
        {rows.length === 0 ? (
          <p className={STYLES.empty}>No items in the shop yet. Add one below.</p>
        ) : (
          <div ref={rowsScrollRef} className={STYLES.rowsScroll}>
            {rows.map((row) => (
              <div key={row.key} className={STYLES.row}>
                <div className={STYLES.rowHeader}>
                  <span className={STYLES.rowTitle}>
                    {row.name || <span className={STYLES.rowTitlePlaceholder}>Untitled item</span>}
                  </span>
                  <RemoveIconButton
                    onClick={() => removeRow(row.key)}
                    label="Remove item"
                    className={STYLES.removeButton}
                    iconClassName={STYLES.removeIcon}
                  />
                </div>

                <div className={STYLES.rowFields}>
                  <div className={STYLES.rowFieldFull}>
                    <label className={STYLES.label}>Name</label>
                    <input
                      type="text"
                      value={row.name}
                      placeholder="e.g. VIP Role"
                      onChange={(e) => updateRow(row.key, { name: e.target.value })}
                      className={STYLES.input}
                    />
                  </div>

                  <div className={STYLES.rowField}>
                    <label className={STYLES.label}>Type</label>
                    <select
                      value={row.type}
                      onChange={(e) =>
                        updateRow(row.key, {
                          type: e.target.value as "role" | "badge",
                          roleId: e.target.value === "role" ? (roles[0]?.id ?? "") : row.roleId,
                          emoji: e.target.value === "badge" ? row.emoji : "",
                        })
                      }
                      className={STYLES.select}
                    >
                      <option value="role">Role (grants a Discord role)</option>
                      <option value="badge">Badge (emoji on /profile)</option>
                    </select>
                  </div>

                  <div className={STYLES.rowField}>
                    <label className={STYLES.label}>Price (coins)</label>
                    <input
                      type="number"
                      min={1}
                      value={row.price}
                      onChange={(e) =>
                        updateRow(row.key, { price: parseInt(e.target.value, 10) || 1 })
                      }
                      className={STYLES.numberInput}
                    />
                  </div>

                  {row.type === "role" ? (
                    <div className={STYLES.rowFieldFull}>
                      <label className={STYLES.label}>Role</label>
                      {roles.length === 0 ? (
                        <p className={STYLES.empty}>No assignable roles found in this server.</p>
                      ) : (
                        <select
                          value={row.roleId ?? ""}
                          onChange={(e) => updateRow(row.key, { roleId: e.target.value })}
                          className={STYLES.select}
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <div className={STYLES.rowFieldFull}>
                      <label className={STYLES.label}>Emoji</label>
                      <input
                        type="text"
                        value={row.emoji ?? ""}
                        placeholder="e.g. ⭐ or <:name:id>"
                        onChange={(e) => updateRow(row.key, { emoji: e.target.value })}
                        className={STYLES.input}
                      />
                    </div>
                  )}

                  <div className={STYLES.rowFieldFull}>
                    <label className={STYLES.label}>Description</label>
                    <input
                      type="text"
                      value={row.description}
                      placeholder="Short description shown in the shop (optional)"
                      onChange={(e) => updateRow(row.key, { description: e.target.value })}
                      className={STYLES.input}
                    />
                  </div>

                  <div className={STYLES.rowFieldFull}>
                    <label className={STYLES.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => updateRow(row.key, { enabled: e.target.checked })}
                        className={STYLES.checkbox}
                      />
                      <span className={STYLES.checkboxLabel}>Visible in shop</span>
                    </label>
                  </div>
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
            <span className={STYLES.errorText}>
              {errorMsg || "Failed to save — try again"}
            </span>
          )}
        </div>
      </SettingsCard>
    </form>
  );
}
