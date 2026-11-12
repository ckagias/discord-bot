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

import { updateBirthdaySettings } from "./actions";

describe("updateBirthdaySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOne.mockReturnValue({ lean });
    lean.mockResolvedValue(null);
    requireAssignableRoles.mockResolvedValue(undefined);
    requireGuildAccess.mockResolvedValue(undefined);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateBirthdaySettings("guild1", new FormData())).rejects.toThrow("forbidden");
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("persists channel, message, and role fields and revalidates", async () => {
    const formData = new FormData();
    formData.set("birthdayChannelId", "chan1");
    formData.set("birthdayMessage", "happy birthday {user}!");
    formData.set("birthdayRoleId", "role1");

    await updateBirthdaySettings("guild1", formData);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      {
        birthdayChannelId: "chan1",
        birthdayMessage: "happy birthday {user}!",
        birthdayRoleId: "role1",
      },
      { upsert: true }
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/birthdays");
  });

  it("rejects a birthday message exceeding the 2000 character limit", async () => {
    const formData = new FormData();
    formData.set("birthdayMessage", "a".repeat(2001));

    await expect(updateBirthdaySettings("guild1", formData)).rejects.toThrow(/2000 character limit/);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  describe("role hierarchy", () => {
    it("asks the bot about a new birthday role, before saving", async () => {
      lean.mockResolvedValue({ birthdayRoleId: "old" });
      const formData = new FormData();
      formData.set("birthdayRoleId", "newRole");

      await updateBirthdaySettings("guild1", formData);

      expect(requireAssignableRoles).toHaveBeenCalledWith("guild1", ["newRole"]);
      expect(requireAssignableRoles.mock.invocationCallOrder[0]).toBeLessThan(findOneAndUpdate.mock.invocationCallOrder[0]);
    });

    it("does not ask about the birthday role when it is unchanged", async () => {
      lean.mockResolvedValue({ birthdayRoleId: "same" });
      const formData = new FormData();
      formData.set("birthdayRoleId", "same");

      await updateBirthdaySettings("guild1", formData);

      expect(requireAssignableRoles).toHaveBeenCalledWith("guild1", []);
    });

    it("saves nothing when the bot refuses the role", async () => {
      requireAssignableRoles.mockRejectedValue(new Error("refused"));
      const formData = new FormData();
      formData.set("birthdayRoleId", "adminRole");

      await expect(updateBirthdaySettings("guild1", formData)).rejects.toThrow("refused");
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
