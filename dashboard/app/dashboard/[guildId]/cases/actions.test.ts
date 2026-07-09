import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndDelete } = vi.hoisted(() => ({ findOneAndDelete: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Case", () => ({ default: { findOneAndDelete } }));

import { deleteCase } from "./actions";

describe("deleteCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks guild access before deleting", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(deleteCase("guild1", 42)).rejects.toThrow("forbidden");
    expect(findOneAndDelete).not.toHaveBeenCalled();
  });

  it("deletes the case scoped to the guild and revalidates", async () => {
    requireGuildAccess.mockResolvedValue(undefined);

    await deleteCase("guild1", 42);

    expect(requireGuildAccess).toHaveBeenCalledWith("guild1");
    expect(findOneAndDelete).toHaveBeenCalledWith({ guildId: "guild1", caseId: 42 });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/cases");
  });
});
