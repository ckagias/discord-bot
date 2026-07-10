const API_BASE = "https://discord.com/api/v10";
const MANAGE_GUILD = 0x20;

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function getOAuthRedirectUri(): string {
  return `${requireEnv("DASHBOARD_URL")}/api/auth/callback`;
}

export function buildAuthorizeUrl(state: string, forceAccountPicker = false): string {
  const params = new URLSearchParams({
    client_id: requireEnv("ClientID"),
    redirect_uri: getOAuthRedirectUri(),
    response_type: "code",
    scope: "identify guilds",
    state,
  });
  // Discord silently reuses the browser's existing Discord session by default.
  // prompt=consent forces the account chooser/consent screen so the user can
  // pick a different Discord account instead of being auto-logged back in.
  if (forceAccountPicker) params.set("prompt", "consent");
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    client_id: requireEnv("ClientID"),
    client_secret: requireEnv("CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: getOAuthRedirectUri(),
  });

  const res = await fetch(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export async function fetchCurrentUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch Discord user: ${res.status}`);
  return res.json();
}

// Discord rate-limits /users/@me/guilds aggressively. The dashboard calls this
// on every guild-scoped page load and again on every server action (auth
// re-check), which can trip 429s within the same few seconds for one user.
// A short cache absorbs that burst without weakening the per-request
// Manage Guild check (the list is still refetched at least every 5s).
const userGuildsCache = new Map<string, { guilds: DiscordGuild[]; expiresAt: number }>();
const USER_GUILDS_CACHE_MS = 5_000;

export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const cached = userGuildsCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.guilds;
  }

  const res = await fetch(`${API_BASE}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 429) {
    // Rate limited — serve stale data if we have it rather than failing the request.
    if (cached) return cached.guilds;
    const body = await res.text();
    throw new Error(`Failed to fetch user guilds: 429 ${body}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch user guilds: ${res.status} ${await res.text()}`);
  }

  const guilds: DiscordGuild[] = await res.json();
  userGuildsCache.set(accessToken, { guilds, expiresAt: Date.now() + USER_GUILDS_CACHE_MS });
  return guilds;
}

export function hasManageGuild(guild: DiscordGuild): boolean {
  return (BigInt(guild.permissions) & BigInt(MANAGE_GUILD)) === BigInt(MANAGE_GUILD);
}

// Uses the bot token — server-only, never sent to the browser.
export async function fetchBotGuildIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let after = "";

  for (;;) {
    const res = await fetch(
      `${API_BASE}/users/@me/guilds?limit=200${after ? `&after=${after}` : ""}`,
      { headers: { Authorization: `Bot ${requireEnv("Token")}` } }
    );
    if (!res.ok) throw new Error(`Failed to fetch bot guilds: ${res.status}`);
    const page: { id: string }[] = await res.json();
    if (page.length === 0) break;
    page.forEach((g) => ids.add(g.id));
    after = page[page.length - 1].id;
    if (page.length < 200) break;
  }

  return ids;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

export interface DiscordRole {
  id: string;
  name: string;
  managed: boolean;
}

// Nearly every settings page fetches channels and/or roles for the same guild
// on every navigation. Rapid tab-switching can fire several of these within
// the same second and trip Discord's per-route rate limit, which previously
// surfaced as an uncaught error and the generic error boundary. A short cache
// (mirroring fetchUserGuilds above) absorbs that burst; 429s serve stale data
// if we have it instead of failing the request.
const guildChannelsCache = new Map<string, { channels: DiscordChannel[]; expiresAt: number }>();
const guildRolesCache = new Map<string, { roles: DiscordRole[]; expiresAt: number }>();
const GUILD_RESOURCE_CACHE_MS = 5_000;

// Uses the bot token — server-only, never sent to the browser.
export async function fetchGuildChannels(guildId: string): Promise<DiscordChannel[]> {
  const cached = guildChannelsCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.channels;
  }

  const res = await fetch(`${API_BASE}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${requireEnv("Token")}` },
  });

  if (res.status === 429) {
    if (cached) return cached.channels;
    const body = await res.text();
    throw new Error(`Failed to fetch guild channels: 429 ${body}`);
  }

  if (!res.ok) throw new Error(`Failed to fetch guild channels: ${res.status}`);

  const channels: DiscordChannel[] = await res.json();
  guildChannelsCache.set(guildId, { channels, expiresAt: Date.now() + GUILD_RESOURCE_CACHE_MS });
  return channels;
}

// Uses the bot token — server-only, never sent to the browser.
export async function fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
  const cached = guildRolesCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.roles;
  }

  const res = await fetch(`${API_BASE}/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${requireEnv("Token")}` },
  });

  if (res.status === 429) {
    if (cached) return cached.roles;
    const body = await res.text();
    throw new Error(`Failed to fetch guild roles: 429 ${body}`);
  }

  if (!res.ok) throw new Error(`Failed to fetch guild roles: ${res.status}`);

  const roles: DiscordRole[] = await res.json();
  guildRolesCache.set(guildId, { roles, expiresAt: Date.now() + GUILD_RESOURCE_CACHE_MS });
  return roles;
}