"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import ReactionRole from "@/lib/models/ReactionRole";

interface ReactionRoleRow {
  messageId: string;
  emoji: string;
  roleId: string;
}

const CUSTOM_EMOJI_RE = /^<a?:\w+:(\d+)>$/;

export async function updateReactionRoles(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const raw = formData.get("reactionRoles")?.toString() ?? "[]";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid reaction roles data.");
  }

  if (!Array.isArray(parsed)) throw new Error("Invalid reaction roles data.");

  const rows: ReactionRoleRow[] = parsed
    .filter(
      (t): t is { messageId: string; emoji: string; roleId: string } =>
        typeof t === "object" &&
        t !== null &&
        typeof t.messageId === "string" &&
        t.messageId.trim().length > 0 &&
        typeof t.emoji === "string" &&
        t.emoji.trim().length > 0 &&
        typeof t.roleId === "string" &&
        t.roleId.length > 0
    )
    .map((t) => {
      const customMatch = t.emoji.trim().match(CUSTOM_EMOJI_RE);
      return {
        messageId: t.messageId.trim(),
        emoji: customMatch ? customMatch[1] : t.emoji.trim(),
        roleId: t.roleId,
      };
    });

  // Dedupe by (messageId, emoji) — last entry wins.
  const seen = new Map<string, ReactionRoleRow>();
  for (const row of rows) {
    seen.set(`${row.messageId}:${row.emoji}`, row);
  }
  const deduped = Array.from(seen.values());

  await ReactionRole.deleteMany({ guildId });
  if (deduped.length > 0) {
    await ReactionRole.insertMany(deduped.map((r) => ({ ...r, guildId })));
  }

  revalidatePath(`/dashboard/${guildId}/reaction-roles`);
}
