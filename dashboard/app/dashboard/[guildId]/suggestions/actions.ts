"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import { emptyToNull } from "@/lib/forms";
import Guild from "@/lib/models/Guild";
import Suggestion from "@/lib/models/Suggestion";
import { getSession } from "@/lib/session";

export async function updateSuggestionSettings(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const update = {
    suggestChannelId: emptyToNull(formData.get("suggestChannelId")),
    suggestApproverRoleId: emptyToNull(formData.get("suggestApproverRoleId")),
  };

  await Guild.findOneAndUpdate({ guildId }, update, { upsert: true });

  revalidatePath(`/dashboard/${guildId}/suggestions`);
}

const BOT_URL = process.env.BOT_INTERNAL_URL ?? "http://bot:4000";
const SECRET = process.env.INTERNAL_API_SECRET ?? "";

async function callBot(path: string, body: object): Promise<string | null> {
  try {
    const res = await fetch(`${BOT_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": SECRET,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return `Bot returned ${res.status}: ${text}`;
    }
    return null;
  } catch (err) {
    return `Could not reach bot: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function setSuggestionStatus(
  guildId: string,
  messageId: string,
  status: "approved" | "denied" | "implemented"
): Promise<{ error?: string }> {
  await requireGuildAccess(guildId);
  const session = await getSession();
  const error = await callBot("/internal/suggestion/status", {
    guildId,
    messageId,
    status,
    staffId: session.userId,
  });
  if (error) return { error };
  revalidatePath(`/dashboard/${guildId}/suggestions`);
  return {};
}

export async function approveSuggestion(guildId: string, messageId: string) {
  return setSuggestionStatus(guildId, messageId, "approved");
}

export async function denySuggestion(guildId: string, messageId: string) {
  return setSuggestionStatus(guildId, messageId, "denied");
}

export async function implementSuggestion(guildId: string, messageId: string) {
  return setSuggestionStatus(guildId, messageId, "implemented");
}

export async function deleteSuggestion(
  guildId: string,
  messageId: string
): Promise<{ error?: string }> {
  await requireGuildAccess(guildId);
  try {
    await connectDB();
    await Suggestion.findOneAndDelete({ guildId, messageId });
    revalidatePath(`/dashboard/${guildId}/suggestions`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
