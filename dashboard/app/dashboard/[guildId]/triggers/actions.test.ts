import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { deleteMany, insertMany } = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  insertMany: vi.fn(),
}));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Trigger", () => ({ default: { deleteMany, insertMany } }));

import { updateTriggers } from "./actions";

describe("updateTriggers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGuildAccess.mockResolvedValue(undefined);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateTriggers("guild1", new FormData())).rejects.toThrow("forbidden");
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("throws on invalid JSON", async () => {
    const formData = new FormData();
    formData.set("triggers", "not json");

    await expect(updateTriggers("guild1", formData)).rejects.toThrow(/Invalid triggers data/);
  });

  it("lowercases the trigger, trims fields, dedupes by trigger (last wins), and revalidates", async () => {
    const formData = new FormData();
    formData.set(
      "triggers",
      JSON.stringify([
        { trigger: " Hello ", response: " first " },
        { trigger: "hello", response: "second" },
      ])
    );

    await updateTriggers("guild1", formData);

    expect(deleteMany).toHaveBeenCalledWith({ guildId: "guild1" });
    expect(insertMany).toHaveBeenCalledWith([
      { trigger: "hello", response: "second", guildId: "guild1" },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/triggers");
  });

  it("throws when a trigger exceeds 100 characters", async () => {
    const formData = new FormData();
    formData.set("triggers", JSON.stringify([{ trigger: "a".repeat(101), response: "r" }]));

    await expect(updateTriggers("guild1", formData)).rejects.toThrow(/100 character limit/);
  });

  it("throws when a response exceeds 500 characters", async () => {
    const formData = new FormData();
    formData.set("triggers", JSON.stringify([{ trigger: "t", response: "a".repeat(501) }]));

    await expect(updateTriggers("guild1", formData)).rejects.toThrow(/500 character limit/);
  });

  it("filters out rows with empty trigger or response", async () => {
    const formData = new FormData();
    formData.set(
      "triggers",
      JSON.stringify([
        { trigger: "", response: "r" },
        { trigger: "t", response: "" },
      ])
    );

    await updateTriggers("guild1", formData);

    expect(insertMany).not.toHaveBeenCalled();
  });
});
