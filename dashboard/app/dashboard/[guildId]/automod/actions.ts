"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import Guild from "@/lib/models/Guild";

function parseWordList(value: FormDataEntryValue | null): string[] {
  const raw = (value ?? "").toString();
  const words = raw
    .split(/[\n,]/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
  return Array.from(new Set(words));
}

const MAX_TIMEOUT_SECONDS = 2419200; // Discord maximum: 28 days

function parsePositiveInt(value: FormDataEntryValue | null, fallback: number, max?: number): number {
  const n = parseInt((value ?? "").toString(), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return max !== undefined ? Math.min(n, max) : n;
}

export async function updateAutomodSettings(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const action = formData.get("automodAction")?.toString();
  const validAction = action === "warn" || action === "timeout" ? action : "delete";

  const update = {
    automodEnabled: formData.get("automodEnabled") === "on",
    automodBannedWords: formData.get("automodBannedWords") === "on",
    automodSpam: formData.get("automodSpam") === "on",
    automodMentions: formData.get("automodMentions") === "on",
    automodInvites: formData.get("automodInvites") === "on",
    automodAction: validAction,
    automodTimeoutSeconds: parsePositiveInt(formData.get("automodTimeoutSeconds"), 300, MAX_TIMEOUT_SECONDS),
    automodBannedWordList: parseWordList(formData.get("automodBannedWordList")),
    automodMentionLimit: parsePositiveInt(formData.get("automodMentionLimit"), 5),
  };

  await Guild.findOneAndUpdate({ guildId }, update, { upsert: true });

  revalidatePath(`/dashboard/${guildId}/automod`);
}
