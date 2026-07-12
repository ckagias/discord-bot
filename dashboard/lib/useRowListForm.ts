import { useEffect, useRef, useState, useTransition } from "react";

interface Keyed {
  key: number;
}

export function useRowListForm<T extends Keyed>({
  initial,
  makeRow,
  submit,
}: {
  initial: Omit<T, "key">[];
  makeRow: (nextKey: number, prev: T[]) => T;
  submit: (rows: T[], form: HTMLFormElement) => Promise<void>;
}) {
  const [rows, setRows] = useState<T[]>(() =>
    initial.map((item, i) => ({ ...item, key: i } as T))
  );
  const [nextKey, setNextKey] = useState(initial.length);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const rowsScrollRef = useRef<HTMLDivElement>(null);
  const shouldScrollToNewRow = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    if (!shouldScrollToNewRow.current) return;
    shouldScrollToNewRow.current = false;
    const el = rowsScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [rows]);

  function mark() {
    setDirty(true);
    setStatus("idle");
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow(nextKey, prev)]);
    setNextKey((k) => k + 1);
    shouldScrollToNewRow.current = true;
    mark();
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    mark();
  }

  function updateRow(key: number, patch: Partial<Omit<T, "key">>) {
    setRows((prev) =>
      prev.map((r) => (r.key !== key ? r : { ...r, ...patch }))
    );
    mark();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("idle");
    const form = e.currentTarget;
    startTransition(async () => {
      try {
        await submit(rows, form);
        setStatus("saved");
        setDirty(false);
      } catch (err) {
        console.error(err);
        setStatus("error");
      }
    });
  }

  return {
    rows,
    setRows,
    dirty,
    mark,
    isPending,
    status,
    rowsScrollRef,
    addRow,
    removeRow,
    updateRow,
    handleSubmit,
  };
}
