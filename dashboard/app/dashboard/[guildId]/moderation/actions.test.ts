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

import { updateModerationSettings } from "./actions";

describe("updateModerationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOne.mockReturnValue({ lean });
    lean.mockResolvedValue(null);
    requireAssignableRoles.mockResolvedValue(undefined);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateModerationSettings("guild1", new FormData())).rejects.toThrow("forbidden");
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("persists muteRoleId, autoroleId, and all log channel fields, then revalidates", async () => {
    requireGuildAccess.mockResolvedValue(undefined);
    const formData = new FormData();
    formData.set("muteRoleId", "role1");
    formData.set("autoroleId", "role2");
    formData.set("logChannelId", "channel1");
    formData.set("memberLogChannelId", "channel2");
    formData.set("moderationLogChannelId", "channel3");
    formData.set("messageLogChannelId", "channel4");
    formData.set("voiceLogChannelId", "channel5");

    await updateModerationSettings("guild1", formData);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      {
        $set: {
          muteRoleId: "role1",
          autoroleId: "role2",
          logChannelId: "channel1",
          memberLogChannelId: "channel2",
          moderationLogChannelId: "channel3",
          messageLogChannelId: "channel4",
          voiceLogChannelId: "channel5",
        },
        $setOnInsert: { guildId: "guild1" },
      },
      { upsert: true }
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/moderation");
  });

  it("stores nulls for empty fields", async () => {
    requireGuildAccess.mockResolvedValue(undefined);

    await updateModerationSettings("guild1", new FormData());

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      {
        $set: {
          muteRoleId: null,
          autoroleId: null,
          logChannelId: null,
          memberLogChannelId: null,
          moderationLogChannelId: null,
          messageLogChannelId: null,
          voiceLogChannelId: null,
        },
        $setOnInsert: { guildId: "guild1" },
      },
      { upsert: true }
    );
  });

  describe("role hierarchy", () => {
    beforeEach(() => {
      requireGuildAccess.mockResolvedValue(undefined);
    });

    it("asks the bot about the roles being added or changed, before saving", async () => {
      lean.mockResolvedValue({ muteRoleId: "oldMute", autoroleId: null });
      const formData = new FormData();
      formData.set("muteRoleId", "newMute");
      formData.set("autoroleId", "newAuto");

      await updateModerationSettings("guild1", formData);

      expect(requireAssignableRoles).toHaveBeenCalledWith("guild1", ["newMute", "newAuto"]);
      expect(requireAssignableRoles.mock.invocationCallOrder[0]).toBeLessThan(findOneAndUpdate.mock.invocationCallOrder[0]);
    });

    it("does not ask about roles that are already saved, so unrelated edits are never blocked", async () => {
      lean.mockResolvedValue({ muteRoleId: "mute", autoroleId: "auto" });
      const formData = new FormData();
      formData.set("muteRoleId", "mute");
      formData.set("autoroleId", "auto");
      formData.set("logChannelId", "channel1");

      await updateModerationSettings("guild1", formData);

      expect(requireAssignableRoles).toHaveBeenCalledWith("guild1", []);
      expect(findOneAndUpdate).toHaveBeenCalled();
    });

    it("saves nothing when the bot refuses a role", async () => {
      requireAssignableRoles.mockRejectedValue(new Error('You can\'t use the "Admin" role here'));
      const formData = new FormData();
      formData.set("autoroleId", "adminRole");

      await expect(updateModerationSettings("guild1", formData)).rejects.toThrow('"Admin" role');
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
