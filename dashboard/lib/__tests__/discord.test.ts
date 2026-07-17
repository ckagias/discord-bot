import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("discord lib", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = originalEnv;
  });

  describe("hasManageGuild", () => {
    it("returns true when the Manage Guild bit is set", async () => {
      const { hasManageGuild } = await import("@/lib/discord");
      expect(hasManageGuild({ id: "1", name: "g", icon: null, permissions: "0x20" })).toBe(true);
    });

    it("returns false when the Manage Guild bit is not set", async () => {
      const { hasManageGuild } = await import("@/lib/discord");
      expect(hasManageGuild({ id: "1", name: "g", icon: null, permissions: "0x0" })).toBe(false);
    });

    it("returns true when Manage Guild is combined with other permission bits", async () => {
      const { hasManageGuild } = await import("@/lib/discord");
      // 0x20 (Manage Guild) | 0x8 (Administrator)
      expect(hasManageGuild({ id: "1", name: "g", icon: null, permissions: "0x28" })).toBe(true);
    });
  });

  describe("fetchUserGuilds", () => {
    it("returns guilds on a successful fetch", async () => {
      const guilds = [{ id: "1", name: "g", icon: null, permissions: "0x20" }];
      vi.mocked(fetch).mockResolvedValue(jsonResponse(guilds));

      const { fetchUserGuilds } = await import("@/lib/discord");
      await expect(fetchUserGuilds("token-a")).resolves.toEqual(guilds);
    });

    it("serves cached guilds on a subsequent call without refetching", async () => {
      const guilds = [{ id: "1", name: "g", icon: null, permissions: "0x20" }];
      vi.mocked(fetch).mockResolvedValue(jsonResponse(guilds));

      const { fetchUserGuilds } = await import("@/lib/discord");
      await fetchUserGuilds("token-b");
      await fetchUserGuilds("token-b");

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("serves stale cached data on a 429 instead of throwing", async () => {
      const guilds = [{ id: "1", name: "g", icon: null, permissions: "0x20" }];
      vi.mocked(fetch)
        .mockResolvedValueOnce(jsonResponse(guilds))
        .mockResolvedValueOnce(jsonResponse({}, 429));

      const { fetchUserGuilds } = await import("@/lib/discord");
      await fetchUserGuilds("token-c");

      await expect(fetchUserGuilds("token-c")).resolves.toEqual(guilds);
    });

    it("throws on a 429 with no cached data", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "rate limited" }, 429));

      const { fetchUserGuilds } = await import("@/lib/discord");
      await expect(fetchUserGuilds("token-d")).rejects.toThrow(/429/);
    });

    it("throws on a non-ok, non-429 response", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "oops" }, 500));

      const { fetchUserGuilds } = await import("@/lib/discord");
      await expect(fetchUserGuilds("token-e")).rejects.toThrow(/500/);
    });
  });

  describe("fetchCurrentUser", () => {
    it("returns the user on success", async () => {
      const user = { id: "1", username: "a", avatar: null };
      vi.mocked(fetch).mockResolvedValue(jsonResponse(user));

      const { fetchCurrentUser } = await import("@/lib/discord");
      await expect(fetchCurrentUser("token")).resolves.toEqual(user);
    });

    it("throws when the response is not ok", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 401));

      const { fetchCurrentUser } = await import("@/lib/discord");
      await expect(fetchCurrentUser("token")).rejects.toThrow(/401/);
    });
  });

  describe("exchangeCodeForToken", () => {
    it("throws when required env vars are missing", async () => {
      const { exchangeCodeForToken } = await import("@/lib/discord");
      await expect(exchangeCodeForToken("code")).rejects.toThrow(/Missing required env var/);
    });

    it("returns the token payload when env vars are present and the request succeeds", async () => {
      process.env.ClientID = "client-id";
      process.env.CLIENT_SECRET = "client-secret";
      process.env.DASHBOARD_URL = "https://dashboard.example.com";
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ access_token: "abc" }));

      const { exchangeCodeForToken } = await import("@/lib/discord");
      await expect(exchangeCodeForToken("code")).resolves.toEqual({ access_token: "abc" });
    });
  });

  describe("buildAuthorizeUrl / getOAuthRedirectUri", () => {
    it("throws when DASHBOARD_URL is missing", async () => {
      const { buildAuthorizeUrl } = await import("@/lib/discord");
      expect(() => buildAuthorizeUrl("state")).toThrow(/Missing required env var/);
    });

    it("builds an authorize URL containing the state and redirect URI", async () => {
      process.env.ClientID = "client-id";
      process.env.DASHBOARD_URL = "https://dashboard.example.com";

      const { buildAuthorizeUrl } = await import("@/lib/discord");
      const url = buildAuthorizeUrl("xyz");

      expect(url).toContain("state=xyz");
      expect(url).toContain(encodeURIComponent("https://dashboard.example.com/api/auth/callback"));
    });
  });

  describe("fetchGuildChannels / fetchGuildRoles / fetchBotGuildIds", () => {
    it("fetchGuildChannels throws when the Token env var is missing", async () => {
      const { fetchGuildChannels } = await import("@/lib/discord");
      await expect(fetchGuildChannels("guild1")).rejects.toThrow(/Missing required env var/);
    });

    it("fetchGuildChannels returns channels using the bot token", async () => {
      process.env.Token = "bot-token";
      const channels = [{ id: "1", name: "general", type: 0 }];
      vi.mocked(fetch).mockResolvedValue(jsonResponse(channels));

      const { fetchGuildChannels } = await import("@/lib/discord");
      await expect(fetchGuildChannels("guild1")).resolves.toEqual(channels);
    });

    it("fetchGuildChannels serves cached channels on a subsequent call without refetching", async () => {
      process.env.Token = "bot-token";
      const channels = [{ id: "1", name: "general", type: 0 }];
      vi.mocked(fetch).mockResolvedValue(jsonResponse(channels));

      const { fetchGuildChannels } = await import("@/lib/discord");
      await fetchGuildChannels("guild-cache");
      await fetchGuildChannels("guild-cache");

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("fetchGuildChannels serves stale cached data on a 429 instead of throwing", async () => {
      process.env.Token = "bot-token";
      const channels = [{ id: "1", name: "general", type: 0 }];
      vi.mocked(fetch)
        .mockResolvedValueOnce(jsonResponse(channels))
        .mockResolvedValueOnce(jsonResponse({}, 429));

      const { fetchGuildChannels } = await import("@/lib/discord");
      await fetchGuildChannels("guild-429");
      await expect(fetchGuildChannels("guild-429")).resolves.toEqual(channels);
    });

    it("fetchGuildChannels throws on a 429 with no cached data", async () => {
      process.env.Token = "bot-token";
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "rate limited" }, 429));

      const { fetchGuildChannels } = await import("@/lib/discord");
      await expect(fetchGuildChannels("guild-429-empty")).rejects.toThrow(/429/);
    });

    it("fetchGuildRoles returns roles using the bot token", async () => {
      process.env.Token = "bot-token";
      const roles = [{ id: "1", name: "admin", managed: false }];
      vi.mocked(fetch).mockResolvedValue(jsonResponse(roles));

      const { fetchGuildRoles } = await import("@/lib/discord");
      await expect(fetchGuildRoles("guild1")).resolves.toEqual(roles);
    });

    it("fetchGuildRoles serves cached roles on a subsequent call without refetching", async () => {
      process.env.Token = "bot-token";
      const roles = [{ id: "1", name: "admin", managed: false }];
      vi.mocked(fetch).mockResolvedValue(jsonResponse(roles));

      const { fetchGuildRoles } = await import("@/lib/discord");
      await fetchGuildRoles("guild-role-cache");
      await fetchGuildRoles("guild-role-cache");

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("fetchGuildRoles serves stale cached data on a 429 instead of throwing", async () => {
      process.env.Token = "bot-token";
      const roles = [{ id: "1", name: "admin", managed: false }];
      vi.mocked(fetch)
        .mockResolvedValueOnce(jsonResponse(roles))
        .mockResolvedValueOnce(jsonResponse({}, 429));

      const { fetchGuildRoles } = await import("@/lib/discord");
      await fetchGuildRoles("guild-role-429");
      await expect(fetchGuildRoles("guild-role-429")).resolves.toEqual(roles);
    });

    it("fetchGuildRoles throws on a 429 with no cached data", async () => {
      process.env.Token = "bot-token";
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "rate limited" }, 429));

      const { fetchGuildRoles } = await import("@/lib/discord");
      await expect(fetchGuildRoles("guild-role-429-empty")).rejects.toThrow(/429/);
    });

    it("fetchBotGuildIds paginates until a short page is returned", async () => {
      process.env.Token = "bot-token";
      const fullPage = Array.from({ length: 200 }, (_, i) => ({ id: `id-${i}` }));
      const lastPage = [{ id: "id-final" }];

      vi.mocked(fetch)
        .mockResolvedValueOnce(jsonResponse(fullPage))
        .mockResolvedValueOnce(jsonResponse(lastPage));

      const { fetchBotGuildIds } = await import("@/lib/discord");
      const ids = await fetchBotGuildIds();

      expect(ids.size).toBe(201);
      expect(ids.has("id-final")).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("fetchGuildMemberName", () => {
    it("prefers the server nickname over the global name and username", async () => {
      process.env.Token = "bot-token";
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ nick: "Nick", user: { global_name: "Global", username: "user" } })
      );

      const { fetchGuildMemberName } = await import("@/lib/discord");
      await expect(fetchGuildMemberName("guild1", "user1")).resolves.toBe("Nick");
    });

    it("falls back to global_name then username when there's no nickname", async () => {
      process.env.Token = "bot-token";
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ user: { global_name: "Global", username: "user" } }));

      const { fetchGuildMemberName } = await import("@/lib/discord");
      await expect(fetchGuildMemberName("guild1", "user1")).resolves.toBe("Global");
    });

    it("returns null instead of throwing when the member lookup fails", async () => {
      process.env.Token = "bot-token";
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "Unknown Member" }, 404));

      const { fetchGuildMemberName } = await import("@/lib/discord");
      await expect(fetchGuildMemberName("guild1", "missing-user")).resolves.toBeNull();
    });

    it("serves cached data on a subsequent call without refetching", async () => {
      process.env.Token = "bot-token";
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ user: { username: "user" } }));

      const { fetchGuildMemberName } = await import("@/lib/discord");
      await fetchGuildMemberName("guild-member-cache", "user1");
      await fetchGuildMemberName("guild-member-cache", "user1");

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("serves stale cached data on a 429 instead of failing", async () => {
      process.env.Token = "bot-token";
      vi.mocked(fetch)
        .mockResolvedValueOnce(jsonResponse({ user: { username: "user" } }))
        .mockResolvedValueOnce(jsonResponse({}, 429));

      const { fetchGuildMemberName } = await import("@/lib/discord");
      await fetchGuildMemberName("guild-member-429", "user1");
      await expect(fetchGuildMemberName("guild-member-429", "user1")).resolves.toBe("user");
    });
  });
});
