import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndUpdate } = vi.hoisted(() => ({ findOneAndUpdate: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Guild", () => ({ default: { findOneAndUpdate } }));

import { updateStarboardSettings } from "./actions";

describe("updateStarboardSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGuildAccess.mockResolvedValue(undefined);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateStarboardSettings("guild1", new FormData())).rejects.toThrow("forbidden");
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("defaults emoji to a star and threshold to 3 when unset", async () => {
    await updateStarboardSettings("guild1", new FormData());

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      {
        $set: {
          starboardEnabled: false,
          starboardChannelId: null,
          starboardEmoji: "⭐",
          starboardThreshold: 3,
          starboardIgnoreNsfw: false,
        },
        $setOnInsert: { guildId: "guild1" },
      },
      { upsert: true }
    );
  });

  it("persists provided values and revalidates", async () => {
    const formData = new FormData();
    formData.set("starboardEnabled", "on");
    formData.set("starboardChannelId", "chan1");
    formData.set("starboardEmoji", "🌟");
    formData.set("starboardThreshold", "5");
    formData.set("starboardIgnoreNsfw", "on");

    await updateStarboardSettings("guild1", formData);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      {
        $set: {
          starboardEnabled: true,
          starboardChannelId: "chan1",
          starboardEmoji: "🌟",
          starboardThreshold: 5,
          starboardIgnoreNsfw: true,
        },
        $setOnInsert: { guildId: "guild1" },
      },
      { upsert: true }
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/starboard");
  });
});
