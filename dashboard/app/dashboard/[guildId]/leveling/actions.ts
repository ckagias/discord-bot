"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import { emptyToNull } from "@/lib/forms";
import Guild from "@/lib/models/Guild";
import type { LevelRole } from "@/lib/models/Guild";

export async function updateLevelingSettings(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const update = {
    levelingEnabled: formData.get("levelingEnabled") === "on",
    levelUpChannelId: emptyToNull(formData.get("levelUpChannelId")),
  };

  await Guild.findOneAndUpdate({ guildId }, { $set: update, $setOnInsert: { guildId } }, { upsert: true });

  revalidatePath(`/dashboard/${guildId}/leveling`);
}

export async function updateLevelRoles(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const raw = formData.get("levelRoles")?.toString() ?? "[]";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid level roles data.");
  }

  if (!Array.isArray(parsed)) throw new Error("Invalid level roles data.");

  const levelRoles: LevelRole[] = parsed
    .filter(
      (t): t is { level: number; roleId: string } =>
        typeof t === "object" &&
        t !== null &&
        typeof t.level === "number" &&
        t.level >= 1 &&
        typeof t.roleId === "string" &&
        t.roleId.length > 0
    )
    .map((t) => ({
      level: Math.floor(t.level),
      roleId: t.roleId,
    }));

  const seen = new Set<number>();
  const deduped = levelRoles.filter((t) => {
    if (seen.has(t.level)) return false;
    seen.add(t.level);
    return true;
  });

  await Guild.findOneAndUpdate(
    { guildId },
    { $set: { levelRoles: deduped }, $setOnInsert: { guildId } },
    { upsert: true }
  );

  revalidatePath(`/dashboard/${guildId}/leveling`);
}
