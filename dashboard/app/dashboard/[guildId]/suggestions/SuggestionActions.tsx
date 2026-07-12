"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { approveSuggestion, denySuggestion, implementSuggestion, deleteSuggestion } from "./actions";

const STYLES = {
  error: "mt-1 text-xs text-[var(--danger)]",
  wrap: "flex flex-col items-end",
  menuWrap: "relative inline-block text-left",
  menuTrigger:
    "cursor-pointer rounded px-2 py-1 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-light)] hover:text-[var(--text)]",
  menuPanel:
    "fixed z-50 w-36 overflow-hidden rounded-lg border border-[var(--border-muted)] bg-[var(--bg)] py-1 shadow-lg",
  menuItem: (variant: "success" | "danger" | "neutral") =>
    [
      "block w-full cursor-pointer px-3 py-1.5 text-left text-xs font-medium disabled:opacity-40 transition-colors",
      variant === "success"
        ? "text-[var(--text-muted)] hover:bg-[var(--success)]/10 hover:text-[var(--success)]"
        : variant === "danger"
        ? "text-[var(--text-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
        : "text-[var(--text-muted)] hover:bg-[var(--bg-light)] hover:text-[var(--text)]",
    ].join(" "),
  iconBtn:
    "cursor-pointer rounded p-1 text-[var(--danger)]/70 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:opacity-40 transition-colors",
  icon: "h-4 w-4",
};

function useRunAction(onRun: () => Promise<{ error?: string }>) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await onRun();
      if (result.error) setError(result.error);
    });
  }

  return { run, pending, error };
}

interface MenuAction {
  label: string;
  variant: "success" | "danger" | "neutral";
  onRun: () => Promise<{ error?: string }>;
}

const MENU_HEIGHT_ESTIMATE = 160;

function ActionsMenu({ actions }: { actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleOpen() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const openUpward = window.innerHeight - rect.bottom < MENU_HEIGHT_ESTIMATE;
      setMenuStyle({
        right: window.innerWidth - rect.right,
        ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }
    setOpen((v) => !v);
  }

  function handleSelect(action: MenuAction) {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await action.onRun();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={STYLES.wrap} ref={wrapRef}>
      <div className={STYLES.menuWrap}>
        <button
          ref={triggerRef}
          onClick={toggleOpen}
          disabled={pending}
          className={STYLES.menuTrigger}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {pending ? "…" : "⋯"}
        </button>
        {open && createPortal(
          <div ref={panelRef} className={STYLES.menuPanel} style={menuStyle} role="menu">
            {actions.map((action) => (
              <button
                key={action.label}
                role="menuitem"
                onClick={() => handleSelect(action)}
                disabled={pending}
                className={STYLES.menuItem(action.variant)}
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
      {error && <p className={STYLES.error}>{error}</p>}
    </div>
  );
}

export function SuggestionReviewActions({
  guildId,
  messageId,
}: {
  guildId: string;
  messageId: string;
}) {
  return (
    <ActionsMenu
      actions={[
        { label: "Approve", variant: "success", onRun: () => approveSuggestion(guildId, messageId) },
        { label: "Deny", variant: "danger", onRun: () => denySuggestion(guildId, messageId) },
        { label: "Implement", variant: "neutral", onRun: () => implementSuggestion(guildId, messageId) },
        { label: "Delete", variant: "danger", onRun: () => deleteSuggestion(guildId, messageId) },
      ]}
    />
  );
}

export function DeleteSuggestionButton({
  guildId,
  messageId,
}: {
  guildId: string;
  messageId: string;
}) {
  const { run, pending, error } = useRunAction(() => deleteSuggestion(guildId, messageId));

  return (
    <div className={STYLES.wrap}>
      <button onClick={run} disabled={pending} className={STYLES.iconBtn} aria-label="Delete suggestion" title="Delete">
        {pending ? (
          "…"
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={STYLES.icon}>
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        )}
      </button>
      {error && <p className={STYLES.error}>{error}</p>}
    </div>
  );
}
