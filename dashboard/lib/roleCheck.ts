import { getSession } from "@/lib/session";

const BOT_URL = process.env.BOT_INTERNAL_URL ?? "http://bot:4000";
const SECRET = process.env.INTERNAL_API_SECRET ?? "";

type RoleChange = [next: string | null | undefined, current: string | null | undefined];

// The roles a save would newly point the bot at: set now and different from what is stored. Roles that are already
// saved are left alone, so editing an unrelated field never fails because of a role someone else set earlier.
export function changedRoleIds(changes: RoleChange[]): string[] {
  return changes.filter(([next, current]) => next && next !== current).map(([next]) => next as string);
}

// The dashboard only knows the user has Manage Server, not which Discord roles they hold. Settings that make the bot
// hand out a role must not accept one the user could not assign themselves, so the bot checks it with the same rule
// the slash commands use. Throws when any role is refused, and when the bot can't be asked (it never fails open).
export async function requireAssignableRoles(guildId: string, roleIds: string[]): Promise<void> {
  const unique = [...new Set(roleIds)];
  if (unique.length === 0) return;

  const { userId } = await getSession();
  if (!userId) throw new Error("Not authenticated");

  let res: Response;
  try {
    res = await fetch(`${BOT_URL}/internal/role/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": SECRET },
      body: JSON.stringify({ guildId, userId, roleIds: unique }),
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not check the selected roles with the bot. Try again in a moment.");
  }

  if (res.ok) return;

  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if ((res.status === 400 || res.status === 403) && body?.error) throw new Error(body.error);
  throw new Error("Could not check the selected roles with the bot. Try again in a moment.");
}
