"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import { emptyToNull } from "@/lib/forms";
import Guild from "@/lib/models/Guild";

export async function updateWelcomeSettings(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const truncate = (v: FormDataEntryValue | null, max: number) => {
    const s = emptyToNull(v);
    if (s && s.length > max) throw new Error(`Message exceeds ${max} character limit.`);
    return s;
  };

  const update = {
    welcomeChannelId: emptyToNull(formData.get("welcomeChannelId")),
    welcomeMessage: truncate(formData.get("welcomeMessage"), 2000),
    farewellChannelId: emptyToNull(formData.get("farewellChannelId")),
    farewellMessage: truncate(formData.get("farewellMessage"), 2000),
  };

  await Guild.findOneAndUpdate({ guildId }, update, { upsert: true });

  revalidatePath(`/dashboard/${guildId}/welcome`);
}
