import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession }));

import { changedRoleIds, requireAssignableRoles } from "@/lib/roleCheck";

describe("changedRoleIds", () => {
  it("returns only roles that are set and different from the stored one", () => {
    expect(
      changedRoleIds([
        ["new", "old"],
        ["same", "same"],
        [null, "removed"],
        ["added", null],
        ["alsoAdded", undefined],
        ["", "x"],
      ])
    ).toEqual(["new", "added", "alsoAdded"]);
  });
});

describe("requireAssignableRoles", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    getSession.mockResolvedValue({ userId: "u1" });
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
  });

  it("does not ask the bot when there is nothing to check", async () => {
    await requireAssignableRoles("guild1", []);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("sends the session user and the de-duplicated roles to the bot", async () => {
    await requireAssignableRoles("guild1", ["r1", "r2", "r1"]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/internal\/role\/validate$/);
    expect(JSON.parse(init.body)).toEqual({ guildId: "guild1", userId: "u1", roleIds: ["r1", "r2"] });
    expect(init.headers["x-internal-secret"]).toBeDefined();
  });

  it("throws when the user is not signed in, without calling the bot", async () => {
    getSession.mockResolvedValue({});

    await expect(requireAssignableRoles("guild1", ["r1"])).rejects.toThrow("Not authenticated");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws the bot's message when a role is refused", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'You can\'t use the "Admin" role here' }) });

    await expect(requireAssignableRoles("guild1", ["r1"])).rejects.toThrow('"Admin" role');
  });

  it("fails closed when the bot is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(requireAssignableRoles("guild1", ["r1"])).rejects.toThrow(/Could not check the selected roles/);
  });

  it("fails closed on a bot error response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "Internal error" }) });

    await expect(requireAssignableRoles("guild1", ["r1"])).rejects.toThrow(/Could not check the selected roles/);
  });
});
