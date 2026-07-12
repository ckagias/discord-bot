"use client";

import { useSelectedLayoutSegment } from "next/navigation";

const STYLES = {
  column: (wide: boolean) => (wide ? "w-full max-w-6xl" : "w-full max-w-4xl"),
};

export default function ContentColumn({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  return <div className={STYLES.column(segment === "warnings")}>{children}</div>;
}
