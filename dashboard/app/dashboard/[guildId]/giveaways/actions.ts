"use server";

import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import Giveaway from "@/lib/models/Giveaway";
import { revalidatePath } from "next/cache";

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

export async function endGiveaway(
  guildId: string,
  messageId: string
): Promise<{ error?: string }> {
  await requireGuildAccess(guildId);
  const error = await callBot("/internal/giveaway/end", { guildId, messageId });
  if (error) return { error };
  revalidatePath(`/dashboard/${guildId}/giveaways`);
  return {};
}

export async function rerollGiveaway(
  guildId: string,
  messageId: string
): Promise<{ error?: string }> {
  await requireGuildAccess(guildId);
  const error = await callBot("/internal/giveaway/reroll", { guildId, messageId });
  if (error) return { error };
  revalidatePath(`/dashboard/${guildId}/giveaways`);
  return {};
}

export async function deleteGiveaway(
  guildId: string,
  messageId: string
): Promise<{ error?: string }> {
  await requireGuildAccess(guildId);
  try {
    await connectDB();
    await Giveaway.findOneAndDelete({ guildId, messageId });
    revalidatePath(`/dashboard/${guildId}/giveaways`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
