"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import { emptyToNull } from "@/lib/forms";
import Guild from "@/lib/models/Guild";

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

  await Guild.findOneAndUpdate({ guildId }, update, { upsert: true });

  revalidatePath(`/dashboard/${guildId}/birthdays`);
}
