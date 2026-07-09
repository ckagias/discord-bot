"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import { emptyToNull } from "@/lib/forms";
import Guild from "@/lib/models/Guild";

export async function updateGeneralSettings(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const update = {
    logChannelId: emptyToNull(formData.get("logChannelId")),
    suggestChannelId: emptyToNull(formData.get("suggestChannelId")),
    suggestApproverRoleId: emptyToNull(formData.get("suggestApproverRoleId")),
  };

  await Guild.findOneAndUpdate({ guildId }, update, { upsert: true });

  revalidatePath(`/dashboard/${guildId}/general`);
}
