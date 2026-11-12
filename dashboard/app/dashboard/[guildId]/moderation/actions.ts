"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import { emptyToNull } from "@/lib/forms";
import Guild from "@/lib/models/Guild";
import { changedRoleIds, requireAssignableRoles } from "@/lib/roleCheck";

export async function updateModerationSettings(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const update = {
    muteRoleId: emptyToNull(formData.get("muteRoleId")),
    autoroleId: emptyToNull(formData.get("autoroleId")),
    logChannelId: emptyToNull(formData.get("logChannelId")),
    memberLogChannelId: emptyToNull(formData.get("memberLogChannelId")),
    moderationLogChannelId: emptyToNull(formData.get("moderationLogChannelId")),
    messageLogChannelId: emptyToNull(formData.get("messageLogChannelId")),
    voiceLogChannelId: emptyToNull(formData.get("voiceLogChannelId")),
  };

  // Only roles being added or changed are checked, so saving other fields never fails over an existing role.
  const current = await Guild.findOne({ guildId }).lean<{ muteRoleId?: string | null; autoroleId?: string | null }>();
  await requireAssignableRoles(
    guildId,
    changedRoleIds([
      [update.muteRoleId, current?.muteRoleId],
      [update.autoroleId, current?.autoroleId],
    ])
  );

  await Guild.findOneAndUpdate({ guildId }, { $set: update, $setOnInsert: { guildId } }, { upsert: true });

  revalidatePath(`/dashboard/${guildId}/moderation`);
}
