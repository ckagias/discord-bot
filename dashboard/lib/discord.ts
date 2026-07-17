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
  // prompt=consent forces the account chooser so the user isn't auto-logged back into their existing session.
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

// Short cache absorbs 429 bursts from repeated per-page-load and per-action auth re-checks.
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

export interface GuildStats {
  memberCount: number;
  onlineCount: number | null;
  boostCount: number;
  boostTier: number;
  verificationLevel: number;
  createdAt: string;
}

// Short cache (mirroring fetchUserGuilds above) absorbs rate-limit bursts from rapid tab-switching.
const guildChannelsCache = new Map<string, { channels: DiscordChannel[]; expiresAt: number }>();
const guildRolesCache = new Map<string, { roles: DiscordRole[]; expiresAt: number }>();
const guildStatsCache = new Map<string, { stats: GuildStats; expiresAt: number }>();
const GUILD_RESOURCE_CACHE_MS = 5_000;

function snowflakeToDate(id: string): string {
  const DISCORD_EPOCH = BigInt(1420070400000);
  const timestampMs = (BigInt(id) >> BigInt(22)) + DISCORD_EPOCH;
  return new Date(Number(timestampMs)).toISOString();
}

export async function fetchGuildStats(guildId: string): Promise<GuildStats> {
  const cached = guildStatsCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.stats;
  }

  const res = await fetch(`${API_BASE}/guilds/${guildId}?with_counts=true`, {
    headers: { Authorization: `Bot ${requireEnv("Token")}` },
  });

  if (res.status === 429) {
    if (cached) return cached.stats;
    const body = await res.text();
    throw new Error(`Failed to fetch guild stats: 429 ${body}`);
  }

  if (!res.ok) throw new Error(`Failed to fetch guild stats: ${res.status}`);

  const data = await res.json();
  const stats: GuildStats = {
    memberCount: data.approximate_member_count ?? 0,
    onlineCount: data.approximate_presence_count ?? null,
    boostCount: data.premium_subscription_count ?? 0,
    boostTier: data.premium_tier ?? 0,
    verificationLevel: data.verification_level ?? 0,
    createdAt: snowflakeToDate(guildId),
  };
  guildStatsCache.set(guildId, { stats, expiresAt: Date.now() + GUILD_RESOURCE_CACHE_MS });
  return stats;
}

export async function fetchBotJoinedAt(guildId: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/members/@me`, {
    headers: { Authorization: `Bot ${requireEnv("Token")}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.joined_at ?? null;
}

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

// Discord has no bulk "get members by ID" endpoint, so this is one request per unique user.
const guildMemberCache = new Map<string, { name: string | null; expiresAt: number }>();

export async function fetchGuildMemberName(guildId: string, userId: string): Promise<string | null> {
  const cacheKey = `${guildId}:${userId}`;
  const cached = guildMemberCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.name;
  }

  const res = await fetch(`${API_BASE}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${requireEnv("Token")}` },
  });

  if (!res.ok) {
    if (cached) return cached.name;
    guildMemberCache.set(cacheKey, { name: null, expiresAt: Date.now() + GUILD_RESOURCE_CACHE_MS });
    return null;
  }

  const data = await res.json();
  const name: string | null = data.nick ?? data.user?.global_name ?? data.user?.username ?? null;
  guildMemberCache.set(cacheKey, { name, expiresAt: Date.now() + GUILD_RESOURCE_CACHE_MS });
  return name;
}