import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndUpdate } = vi.hoisted(() => ({ findOneAndUpdate: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Guild", () => ({ default: { findOneAndUpdate } }));

import { updateWelcomeSettings } from "./actions";

describe("updateWelcomeSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGuildAccess.mockResolvedValue(undefined);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateWelcomeSettings("guild1", new FormData())).rejects.toThrow("forbidden");
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("persists channel and message fields and revalidates", async () => {
    const formData = new FormData();
    formData.set("welcomeChannelId", "chan1");
    formData.set("welcomeMessage", "hi {user}");
    formData.set("farewellChannelId", "chan2");
    formData.set("farewellMessage", "bye {user}");

    await updateWelcomeSettings("guild1", formData);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      {
        welcomeChannelId: "chan1",
        welcomeMessage: "hi {user}",
        farewellChannelId: "chan2",
        farewellMessage: "bye {user}",
      },
      { upsert: true }
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/welcome");
  });

  it("rejects a welcome message exceeding the 2000 character limit", async () => {
    const formData = new FormData();
    formData.set("welcomeMessage", "a".repeat(2001));

    await expect(updateWelcomeSettings("guild1", formData)).rejects.toThrow(/2000 character limit/);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects a farewell message exceeding the 2000 character limit", async () => {
    const formData = new FormData();
    formData.set("farewellMessage", "a".repeat(2001));

    await expect(updateWelcomeSettings("guild1", formData)).rejects.toThrow(/2000 character limit/);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});
