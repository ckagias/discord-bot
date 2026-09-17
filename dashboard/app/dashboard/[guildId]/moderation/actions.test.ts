import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndUpdate } = vi.hoisted(() => ({ findOneAndUpdate: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Guild", () => ({ default: { findOneAndUpdate } }));

import { updateModerationSettings } from "./actions";

describe("updateModerationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
