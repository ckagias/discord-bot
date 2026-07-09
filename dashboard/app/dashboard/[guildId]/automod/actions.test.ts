import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndUpdate } = vi.hoisted(() => ({ findOneAndUpdate: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Guild", () => ({ default: { findOneAndUpdate } }));

import { updateAutomodSettings } from "./actions";

describe("updateAutomodSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGuildAccess.mockResolvedValue(undefined);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateAutomodSettings("guild1", new FormData())).rejects.toThrow("forbidden");
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("defaults action to delete when unset or invalid", async () => {
    const formData = new FormData();
    formData.set("automodAction", "not-a-real-action");

    await updateAutomodSettings("guild1", formData);

    const update = findOneAndUpdate.mock.calls[0][1];
    expect(update.automodAction).toBe("delete");
  });

  it("accepts warn and timeout as valid actions", async () => {
    const formData = new FormData();
    formData.set("automodAction", "warn");
    await updateAutomodSettings("guild1", formData);
    expect(findOneAndUpdate.mock.calls[0][1].automodAction).toBe("warn");

    formData.set("automodAction", "timeout");
    await updateAutomodSettings("guild1", formData);
    expect(findOneAndUpdate.mock.calls[1][1].automodAction).toBe("timeout");
  });

  it("clamps automodTimeoutSeconds to the 28-day Discord max", async () => {
    const formData = new FormData();
    formData.set("automodTimeoutSeconds", "999999999");

    await updateAutomodSettings("guild1", formData);

    expect(findOneAndUpdate.mock.calls[0][1].automodTimeoutSeconds).toBe(2419200);
  });

  it("parses, lowercases, trims, and dedupes the banned word list", async () => {
    const formData = new FormData();
    formData.set("automodBannedWordList", "Foo, bar\nFOO\n  baz  ,bar");

    await updateAutomodSettings("guild1", formData);

    expect(findOneAndUpdate.mock.calls[0][1].automodBannedWordList.sort()).toEqual(
      ["bar", "baz", "foo"].sort()
    );
  });

  it("persists boolean toggles and revalidates", async () => {
    const formData = new FormData();
    formData.set("automodEnabled", "on");
    formData.set("automodBannedWords", "on");
    formData.set("automodSpam", "on");
    formData.set("automodMentions", "on");
    formData.set("automodInvites", "on");

    await updateAutomodSettings("guild1", formData);

    const update = findOneAndUpdate.mock.calls[0][1];
    expect(update.automodEnabled).toBe(true);
    expect(update.automodBannedWords).toBe(true);
    expect(update.automodSpam).toBe(true);
    expect(update.automodMentions).toBe(true);
    expect(update.automodInvites).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/automod");
  });
});
