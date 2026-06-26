"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import Guild from "@/lib/models/Guild";
import { emptyToNull } from "@/lib/forms";

function parsePositiveInt(value: FormDataEntryValue | null, fallback: number): number {
  const n = parseInt((value ?? "").toString(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function updateAntiRaidSettings(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  // antiRaidLocked / antiRaidLockedAt are bot-owned runtime state — never written here.
  const update = {
    antiRaidEnabled: formData.get("antiRaidEnabled") === "on",
    antiRaidQuarantineRoleId: emptyToNull(formData.get("antiRaidQuarantineRoleId")),
    antiRaidJoinThreshold: parsePositiveInt(formData.get("antiRaidJoinThreshold"), 10),
    antiRaidJoinWindow: parsePositiveInt(formData.get("antiRaidJoinWindow"), 10),
    antiRaidAlertChannelId: emptyToNull(formData.get("antiRaidAlertChannelId")),
  };

  await Guild.findOneAndUpdate(
    { guildId },
    { $set: update, $setOnInsert: { guildId } },
    { upsert: true }
  );

  revalidatePath(`/dashboard/${guildId}/anti-raid`);
}
