import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
const { fetchUserGuilds, hasManageGuild } = vi.hoisted(() => ({
  fetchUserGuilds: vi.fn(),
  hasManageGuild: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/discord", () => ({ fetchUserGuilds, hasManageGuild }));

import { requireGuildAccess, ForbiddenError } from "@/lib/authorize";

describe("requireGuildAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws ForbiddenError when not authenticated", async () => {
    getSession.mockResolvedValue({});

    await expect(requireGuildAccess("guild1")).rejects.toThrow(ForbiddenError);
    expect(fetchUserGuilds).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when the user has no access token", async () => {
    getSession.mockResolvedValue({ userId: "u1" });

    await expect(requireGuildAccess("guild1")).rejects.toThrow(ForbiddenError);
  });

  it("throws ForbiddenError when the guild is not in the user's guild list", async () => {
    getSession.mockResolvedValue({ userId: "u1", accessToken: "token" });
    fetchUserGuilds.mockResolvedValue([{ id: "otherGuild", permissions: "0" }]);

    await expect(requireGuildAccess("guild1")).rejects.toThrow(ForbiddenError);
  });

  it("throws ForbiddenError when the user lacks Manage Guild on the guild", async () => {
    const guild = { id: "guild1", permissions: "0" };
    getSession.mockResolvedValue({ userId: "u1", accessToken: "token" });
    fetchUserGuilds.mockResolvedValue([guild]);
    hasManageGuild.mockReturnValue(false);

    await expect(requireGuildAccess("guild1")).rejects.toThrow(ForbiddenError);
    expect(hasManageGuild).toHaveBeenCalledWith(guild);
  });

  it("resolves without throwing when the user has Manage Guild", async () => {
    const guild = { id: "guild1", permissions: "0x20" };
    getSession.mockResolvedValue({ userId: "u1", accessToken: "token" });
    fetchUserGuilds.mockResolvedValue([guild]);
    hasManageGuild.mockReturnValue(true);

    await expect(requireGuildAccess("guild1")).resolves.toBeUndefined();
  });
});
