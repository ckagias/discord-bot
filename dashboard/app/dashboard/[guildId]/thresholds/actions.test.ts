import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndUpdate } = vi.hoisted(() => ({ findOneAndUpdate: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Guild", () => ({ default: { findOneAndUpdate } }));

import { updateWarnThresholds } from "./actions";

describe("updateWarnThresholds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGuildAccess.mockResolvedValue(undefined);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateWarnThresholds("guild1", new FormData())).rejects.toThrow("forbidden");
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("throws on invalid JSON", async () => {
    const formData = new FormData();
    formData.set("warnThresholds", "not json");

    await expect(updateWarnThresholds("guild1", formData)).rejects.toThrow(/Invalid threshold data/);
  });

  it("filters out invalid actions and counts", async () => {
    const formData = new FormData();
    formData.set(
      "warnThresholds",
      JSON.stringify([
        { count: 3, action: "kick" },
        { count: 0, action: "kick" },
        { count: 5, action: "not-a-real-action" },
      ])
    );

    await updateWarnThresholds("guild1", formData);

    expect(findOneAndUpdate.mock.calls[0][1].$set.warnThresholds).toEqual([
      { count: 3, action: "kick", duration: null },
    ]);
  });

  it("keeps duration only for timeout actions with a positive number", async () => {
    const formData = new FormData();
    formData.set(
      "warnThresholds",
      JSON.stringify([
        { count: 1, action: "timeout", duration: 60 },
        { count: 2, action: "ban", duration: 60 },
        { count: 3, action: "timeout", duration: -1 },
      ])
    );

    await updateWarnThresholds("guild1", formData);

    expect(findOneAndUpdate.mock.calls[0][1].$set.warnThresholds).toEqual([
      { count: 1, action: "timeout", duration: 60 },
      { count: 2, action: "ban", duration: null },
      { count: 3, action: "timeout", duration: null },
    ]);
  });

  it("dedupes by count, keeping the first occurrence, and revalidates", async () => {
    const formData = new FormData();
    formData.set(
      "warnThresholds",
      JSON.stringify([
        { count: 3, action: "kick" },
        { count: 3, action: "ban" },
      ])
    );

    await updateWarnThresholds("guild1", formData);

    expect(findOneAndUpdate.mock.calls[0][1].$set.warnThresholds).toEqual([
      { count: 3, action: "kick", duration: null },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/thresholds");
  });
});
