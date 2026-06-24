"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import Guild from "@/lib/models/Guild";
import type { WarnThreshold } from "@/lib/models/Guild";

export async function updateWarnThresholds(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const raw = formData.get("warnThresholds")?.toString() ?? "[]";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid threshold data.");
  }

  if (!Array.isArray(parsed)) throw new Error("Invalid threshold data.");

  const VALID_ACTIONS = new Set(["timeout", "kick", "ban"]);

  const thresholds: WarnThreshold[] = parsed
    .filter(
      (t): t is { count: number; action: string; duration: number | null } =>
        typeof t === "object" &&
        t !== null &&
        typeof t.count === "number" &&
        t.count >= 1 &&
        VALID_ACTIONS.has(t.action)
    )
    .map((t) => ({
      count: Math.floor(t.count),
      action: t.action as WarnThreshold["action"],
      duration:
        t.action === "timeout" && typeof t.duration === "number" && t.duration > 0
          ? Math.floor(t.duration)
          : null,
    }));

  // Deduplicate by count — last entry wins (shouldn't happen via the UI but be safe).
  const seen = new Set<number>();
  const deduped = thresholds.filter((t) => {
    if (seen.has(t.count)) return false;
    seen.add(t.count);
    return true;
  });

  await Guild.findOneAndUpdate(
    { guildId },
    { $set: { warnThresholds: deduped }, $setOnInsert: { guildId } },
    { upsert: true }
  );

  revalidatePath(`/dashboard/${guildId}/thresholds`);
}
