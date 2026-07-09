import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndDelete } = vi.hoisted(() => ({ findOneAndDelete: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Warn", () => ({ default: { findOneAndDelete } }));

import { deleteWarn } from "./actions";

describe("deleteWarn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks guild access before deleting", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(deleteWarn("guild1", "warn1")).rejects.toThrow("forbidden");
    expect(findOneAndDelete).not.toHaveBeenCalled();
  });

  it("deletes the warn scoped to the guild and revalidates", async () => {
    requireGuildAccess.mockResolvedValue(undefined);

    await deleteWarn("guild1", "warn1");

    expect(requireGuildAccess).toHaveBeenCalledWith("guild1");
    expect(findOneAndDelete).toHaveBeenCalledWith({ _id: "warn1", guildId: "guild1" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/warnings");
  });
});
