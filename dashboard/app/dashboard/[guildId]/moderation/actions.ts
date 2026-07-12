"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import { emptyToNull } from "@/lib/forms";
import Guild from "@/lib/models/Guild";

export async function updateModerationSettings(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const update = {
    muteRoleId: emptyToNull(formData.get("muteRoleId")),
    autoroleId: emptyToNull(formData.get("autoroleId")),
    logChannelId: emptyToNull(formData.get("logChannelId")),
  };

  await Guild.findOneAndUpdate({ guildId }, { $set: update, $setOnInsert: { guildId } }, { upsert: true });

  revalidatePath(`/dashboard/${guildId}/moderation`);
}
