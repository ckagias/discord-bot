"use server";

import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import Guild from "@/lib/models/Guild";
import { emptyToNull } from "@/lib/forms";
import { getSession } from "@/lib/session";

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

export async function lockServer(guildId: string): Promise<{ error?: string }> {
  await requireGuildAccess(guildId);
  const { username } = await getSession();
  const error = await callBot("/internal/antiraid/lock", { guildId, username });
  if (error) return { error };
  revalidatePath(`/dashboard/${guildId}/anti-raid`);
  return {};
}

export async function unlockServer(guildId: string): Promise<{ error?: string }> {
  await requireGuildAccess(guildId);
  const { username } = await getSession();
  const error = await callBot("/internal/antiraid/unlock", { guildId, username });
  if (error) return { error };
  revalidatePath(`/dashboard/${guildId}/anti-raid`);
  return {};
}
