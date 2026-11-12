"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import { emptyToNull } from "@/lib/forms";
import Guild from "@/lib/models/Guild";
import { changedRoleIds, requireAssignableRoles } from "@/lib/roleCheck";

export async function updateBirthdaySettings(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const message = emptyToNull(formData.get("birthdayMessage"));
  if (message && message.length > 2000) {
    throw new Error("Message exceeds 2000 character limit.");
  }

  const update = {
    birthdayChannelId: emptyToNull(formData.get("birthdayChannelId")),
    birthdayMessage: message,
    birthdayRoleId: emptyToNull(formData.get("birthdayRoleId")),
  };

  const current = await Guild.findOne({ guildId }).lean<{ birthdayRoleId?: string | null }>();
  await requireAssignableRoles(guildId, changedRoleIds([[update.birthdayRoleId, current?.birthdayRoleId]]));

  await Guild.findOneAndUpdate({ guildId }, update, { upsert: true });

  revalidatePath(`/dashboard/${guildId}/birthdays`);
}
