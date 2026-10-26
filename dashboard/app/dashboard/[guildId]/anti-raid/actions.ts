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

// Same limits as `/antiraid config`, so the dashboard can't save a value the command would refuse. The window cap also
// keeps the bot's persisted join history (one hour) longer than any window.
const JOIN_THRESHOLD_MIN = 2;
const JOIN_THRESHOLD_MAX = 100;
const JOIN_WINDOW_MIN = 3;
const JOIN_WINDOW_MAX = 300;

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export async function updateAntiRaidSettings(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  // antiRaidLocked / antiRaidLockedAt are bot-owned runtime state — never written here.
  const update = {
    antiRaidEnabled: formData.get("antiRaidEnabled") === "on",
    antiRaidQuarantineRoleId: emptyToNull(formData.get("antiRaidQuarantineRoleId")),
    antiRaidJoinThreshold: clamp(parsePositiveInt(formData.get("antiRaidJoinThreshold"), 10), JOIN_THRESHOLD_MIN, JOIN_THRESHOLD_MAX),
    antiRaidJoinWindow: clamp(parsePositiveInt(formData.get("antiRaidJoinWindow"), 10), JOIN_WINDOW_MIN, JOIN_WINDOW_MAX),
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
