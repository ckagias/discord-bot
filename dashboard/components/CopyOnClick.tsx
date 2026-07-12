"use client";

import { useState } from "react";

const STYLES = {
  button: "cursor-pointer text-left hover:underline",
  buttonUntruncated: "block max-w-[12rem] cursor-pointer truncate text-left hover:underline",
};

const TRUNCATE_CHARS = 7;

// Shortens a name to its first word, then to a fixed char count, appending an ellipsis if cut.
function truncateName(name: string) {
  const firstWord = name.trim().split(/\s+/)[0] ?? "";
  if (firstWord.length <= TRUNCATE_CHARS) return firstWord.length < name.trim().length ? `${firstWord}…` : firstWord;
  return `${firstWord.slice(0, TRUNCATE_CHARS)}…`;
}

interface Props {
  value: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  truncate?: boolean;
}

export default function CopyOnClick({ value, children, className, title, truncate }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const label = truncate && typeof children === "string" ? truncateName(children) : children;
  const base = truncate ? STYLES.button : STYLES.buttonUntruncated;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title ?? `Click to copy ${value}`}
      className={[base, className].filter(Boolean).join(" ")}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
