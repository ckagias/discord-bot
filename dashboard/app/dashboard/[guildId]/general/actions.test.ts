import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndUpdate } = vi.hoisted(() => ({ findOneAndUpdate: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Guild", () => ({ default: { findOneAndUpdate } }));

import { updateGeneralSettings } from "./actions";

describe("updateGeneralSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));
    const formData = new FormData();

    await expect(updateGeneralSettings("guild1", formData)).rejects.toThrow("forbidden");
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("persists logChannelId and the suggestion box settings, then revalidates the page", async () => {
    requireGuildAccess.mockResolvedValue(undefined);
    const formData = new FormData();
    formData.set("logChannelId", "12345");
    formData.set("suggestChannelId", "67890");
    formData.set("suggestApproverRoleId", "role1");

    await updateGeneralSettings("guild1", formData);

    expect(requireGuildAccess).toHaveBeenCalledWith("guild1");
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      { logChannelId: "12345", suggestChannelId: "67890", suggestApproverRoleId: "role1" },
      { upsert: true }
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/general");
  });

  it("stores null when fields are empty", async () => {
    requireGuildAccess.mockResolvedValue(undefined);
    const formData = new FormData();

    await updateGeneralSettings("guild1", formData);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      { logChannelId: null, suggestChannelId: null, suggestApproverRoleId: null },
      { upsert: true }
    );
  });
});
