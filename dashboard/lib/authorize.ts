import { fetchUserGuilds, hasManageGuild } from "@/lib/discord";
import { getSession } from "@/lib/session";

// Distinct from network/API errors, which should surface as real errors rather than a misleading 404.
export class ForbiddenError extends Error {}

// Never trust a guildId from the URL/form alone — always re-check here.
export async function requireGuildAccess(guildId: string): Promise<void> {
  const session = await getSession();
  if (!session.userId || !session.accessToken) {
    throw new ForbiddenError("Not authenticated");
  }

  const guilds = await fetchUserGuilds(session.accessToken);
  const guild = guilds.find((g) => g.id === guildId);

  if (!guild || !hasManageGuild(guild)) {
    throw new ForbiddenError("Missing Manage Guild permission for this server");
  }
}