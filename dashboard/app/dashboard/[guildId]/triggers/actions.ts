"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import Trigger from "@/lib/models/Trigger";

interface TriggerRow {
  trigger: string;
  response: string;
}

export async function updateTriggers(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const raw = formData.get("triggers")?.toString() ?? "[]";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid triggers data.");
  }

  if (!Array.isArray(parsed)) throw new Error("Invalid triggers data.");

  const rows: TriggerRow[] = parsed
    .filter(
      (t): t is { trigger: string; response: string } =>
        typeof t === "object" &&
        t !== null &&
        typeof t.trigger === "string" &&
        t.trigger.trim().length > 0 &&
        typeof t.response === "string" &&
        t.response.trim().length > 0
    )
    .map((t) => {
      const trigger = t.trigger.trim().toLowerCase();
      const response = t.response.trim();
      if (trigger.length > 100) throw new Error(`Trigger "${trigger.slice(0, 20)}…" exceeds 100 character limit.`);
      if (response.length > 500) throw new Error(`Response for trigger "${trigger.slice(0, 20)}…" exceeds 500 character limit.`);
      return { trigger, response };
    });

  // Dedupe by trigger — last entry wins, matching bot's addtrigger.js logic.
  const seen = new Map<string, TriggerRow>();
  for (const row of rows) {
    seen.set(row.trigger, row);
  }
  const deduped = Array.from(seen.values());

  await Trigger.deleteMany({ guildId });
  if (deduped.length > 0) {
    await Trigger.insertMany(deduped.map((r) => ({ ...r, guildId })));
  }

  revalidatePath(`/dashboard/${guildId}/triggers`);
}
