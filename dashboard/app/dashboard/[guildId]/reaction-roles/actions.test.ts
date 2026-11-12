import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { deleteMany, insertMany, find, lean } = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  insertMany: vi.fn(),
  find: vi.fn(),
  lean: vi.fn(),
}));
const { requireAssignableRoles } = vi.hoisted(() => ({ requireAssignableRoles: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/models/ReactionRole", () => ({ default: { deleteMany, insertMany, find } }));
vi.mock("@/lib/roleCheck", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roleCheck")>()),
  requireAssignableRoles,
}));

import { updateReactionRoles } from "./actions";

describe("updateReactionRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    find.mockReturnValue({ lean });
    lean.mockResolvedValue([]);
    requireAssignableRoles.mockResolvedValue(undefined);
    requireGuildAccess.mockResolvedValue(undefined);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateReactionRoles("guild1", new FormData())).rejects.toThrow("forbidden");
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("throws on invalid JSON", async () => {
    const formData = new FormData();
    formData.set("reactionRoles", "{not json");

    await expect(updateReactionRoles("guild1", formData)).rejects.toThrow(/Invalid reaction roles/);
  });

  it("replaces existing rows with the new deduped set", async () => {
    const formData = new FormData();
    formData.set(
      "reactionRoles",
      JSON.stringify([
        { messageId: "m1", emoji: "😀", roleId: "r1" },
        { messageId: "m1", emoji: "😀", roleId: "r2" },
      ])
    );

    await updateReactionRoles("guild1", formData);

    expect(deleteMany).toHaveBeenCalledWith({ guildId: "guild1" });
    expect(insertMany).toHaveBeenCalledWith([{ messageId: "m1", emoji: "😀", roleId: "r2", guildId: "guild1" }]);
  });

  it("extracts the custom emoji ID from Discord's <a?:name:id> syntax", async () => {
    const formData = new FormData();
    formData.set(
      "reactionRoles",
      JSON.stringify([{ messageId: "m1", emoji: "<:custom:123456789>", roleId: "r1" }])
    );

    await updateReactionRoles("guild1", formData);

    expect(insertMany).toHaveBeenCalledWith([
      { messageId: "m1", emoji: "123456789", roleId: "r1", guildId: "guild1" },
    ]);
  });

  it("skips insertMany when the deduped list is empty", async () => {
    await updateReactionRoles("guild1", new FormData());

    expect(deleteMany).toHaveBeenCalledWith({ guildId: "guild1" });
    expect(insertMany).not.toHaveBeenCalled();
  });

  it("filters out rows missing required fields", async () => {
    const formData = new FormData();
    formData.set(
      "reactionRoles",
      JSON.stringify([
        { messageId: "", emoji: "😀", roleId: "r1" },
        { messageId: "m1", emoji: "", roleId: "r1" },
        { messageId: "m1", emoji: "😀", roleId: "" },
      ])
    );

    await updateReactionRoles("guild1", formData);

    expect(insertMany).not.toHaveBeenCalled();
  });

  describe("role hierarchy", () => {
    function rowsFormData(rows: unknown[]) {
      const formData = new FormData();
      formData.set("reactionRoles", JSON.stringify(rows));
      return formData;
    }

    it("asks the bot about new rows and rows pointed at a different role, before replacing anything", async () => {
      lean.mockResolvedValue([
        { messageId: "m1", emoji: "⭐", roleId: "kept" },
        { messageId: "m1", emoji: "🔥", roleId: "old" },
      ]);

      await updateReactionRoles(
        "guild1",
        rowsFormData([
          { messageId: "m1", emoji: "⭐", roleId: "kept" },
          { messageId: "m1", emoji: "🔥", roleId: "replacement" },
          { messageId: "m2", emoji: "⭐", roleId: "kept" },
        ])
      );

      // The third row reuses a stored role, but on a message and emoji that had no binding, so it counts as new.
      expect(requireAssignableRoles).toHaveBeenCalledWith("guild1", ["replacement", "kept"]);
      expect(requireAssignableRoles.mock.invocationCallOrder[0]).toBeLessThan(deleteMany.mock.invocationCallOrder[0]);
    });

    it("replaces nothing when the bot refuses a role", async () => {
      requireAssignableRoles.mockRejectedValue(new Error("refused"));

      await expect(
        updateReactionRoles("guild1", rowsFormData([{ messageId: "m1", emoji: "⭐", roleId: "adminRole" }]))
      ).rejects.toThrow("refused");
      expect(deleteMany).not.toHaveBeenCalled();
      expect(insertMany).not.toHaveBeenCalled();
    });
  });
});
