import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndUpdate, findOne, lean } = vi.hoisted(() => ({ findOneAndUpdate: vi.fn(), findOne: vi.fn(), lean: vi.fn() }));
const { requireAssignableRoles } = vi.hoisted(() => ({ requireAssignableRoles: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Guild", () => ({ default: { findOneAndUpdate, findOne } }));
vi.mock("@/lib/roleCheck", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roleCheck")>()),
  requireAssignableRoles,
}));

import { updateLevelingSettings } from "./actions";

describe("updateLevelingSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOne.mockReturnValue({ lean });
    lean.mockResolvedValue(null);
    requireAssignableRoles.mockResolvedValue(undefined);
    requireGuildAccess.mockResolvedValue(undefined);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateLevelingSettings("guild1", new FormData())).rejects.toThrow("forbidden");
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("persists levelingEnabled, levelUpChannelId, and levelRoles and revalidates", async () => {
    const formData = new FormData();
    formData.set("levelingEnabled", "on");
    formData.set("levelUpChannelId", "chan1");
    formData.set("levelRoles", JSON.stringify([{ level: 5, roleId: "r1" }]));

    await updateLevelingSettings("guild1", formData);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      {
        $set: {
          levelingEnabled: true,
          levelUpChannelId: "chan1",
          levelRoles: [{ level: 5, roleId: "r1" }],
        },
        $setOnInsert: { guildId: "guild1" },
      },
      { upsert: true }
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/leveling");
  });

  it("throws on invalid JSON", async () => {
    const formData = new FormData();
    formData.set("levelRoles", "not json");

    await expect(updateLevelingSettings("guild1", formData)).rejects.toThrow(/Invalid level roles/);
  });

  it("throws when the payload is not an array", async () => {
    const formData = new FormData();
    formData.set("levelRoles", JSON.stringify({ level: 1, roleId: "r1" }));

    await expect(updateLevelingSettings("guild1", formData)).rejects.toThrow(/Invalid level roles/);
  });

  it("filters out malformed rows and normalizes valid ones", async () => {
    const formData = new FormData();
    formData.set(
      "levelRoles",
      JSON.stringify([
        { level: 5, roleId: "r1" },
        { level: 3.7, roleId: "r2" },
        { level: 0, roleId: "r3" },
        { level: "not a number", roleId: "r4" },
        { level: 2, roleId: "" },
      ])
    );

    await updateLevelingSettings("guild1", formData);

    expect(findOneAndUpdate.mock.calls[0][1].$set.levelRoles).toEqual([
      { level: 5, roleId: "r1" },
      { level: 3, roleId: "r2" },
    ]);
  });

  it("dedupes by level, keeping the first occurrence", async () => {
    const formData = new FormData();
    formData.set(
      "levelRoles",
      JSON.stringify([
        { level: 5, roleId: "first" },
        { level: 5, roleId: "second" },
      ])
    );

    await updateLevelingSettings("guild1", formData);

    expect(findOneAndUpdate.mock.calls[0][1].$set.levelRoles).toEqual([{ level: 5, roleId: "first" }]);
  });

  it("defaults to an empty array when levelRoles is missing", async () => {
    const formData = new FormData();
    formData.set("levelingEnabled", "on");

    await updateLevelingSettings("guild1", formData);

    expect(findOneAndUpdate.mock.calls[0][1].$set.levelRoles).toEqual([]);
  });

  describe("role hierarchy", () => {
    function rolesFormData(rows: unknown[]) {
      const formData = new FormData();
      formData.set("levelRoles", JSON.stringify(rows));
      return formData;
    }

    it("asks the bot about new roles and roles that replace the one stored for a level", async () => {
      lean.mockResolvedValue({ levelRoles: [{ level: 5, roleId: "kept" }, { level: 10, roleId: "old" }] });

      await updateLevelingSettings(
        "guild1",
        rolesFormData([
          { level: 5, roleId: "kept" },
          { level: 10, roleId: "replacement" },
          { level: 20, roleId: "brandNew" },
        ])
      );

      expect(requireAssignableRoles).toHaveBeenCalledWith("guild1", ["replacement", "brandNew"]);
      expect(requireAssignableRoles.mock.invocationCallOrder[0]).toBeLessThan(findOneAndUpdate.mock.invocationCallOrder[0]);
    });

    it("saves nothing when the bot refuses a role", async () => {
      requireAssignableRoles.mockRejectedValue(new Error("refused"));

      await expect(updateLevelingSettings("guild1", rolesFormData([{ level: 5, roleId: "adminRole" }]))).rejects.toThrow("refused");
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
