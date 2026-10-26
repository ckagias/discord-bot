import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndUpdate } = vi.hoisted(() => ({ findOneAndUpdate: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Guild", () => ({ default: { findOneAndUpdate } }));

import { updateAntiRaidSettings } from "./actions";

describe("updateAntiRaidSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGuildAccess.mockResolvedValue(undefined);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateAntiRaidSettings("guild1", new FormData())).rejects.toThrow("forbidden");
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("falls back to defaults for invalid/missing numeric fields", async () => {
    await updateAntiRaidSettings("guild1", new FormData());

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      {
        $set: {
          antiRaidEnabled: false,
          antiRaidQuarantineRoleId: null,
          antiRaidJoinThreshold: 10,
          antiRaidJoinWindow: 10,
          antiRaidAlertChannelId: null,
        },
        $setOnInsert: { guildId: "guild1" },
      },
      { upsert: true }
    );
  });

  it("persists provided values and revalidates", async () => {
    const formData = new FormData();
    formData.set("antiRaidEnabled", "on");
    formData.set("antiRaidQuarantineRoleId", "role1");
    formData.set("antiRaidJoinThreshold", "20");
    formData.set("antiRaidJoinWindow", "30");
    formData.set("antiRaidAlertChannelId", "chan1");

    await updateAntiRaidSettings("guild1", formData);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      {
        $set: {
          antiRaidEnabled: true,
          antiRaidQuarantineRoleId: "role1",
          antiRaidJoinThreshold: 20,
          antiRaidJoinWindow: 30,
          antiRaidAlertChannelId: "chan1",
        },
        $setOnInsert: { guildId: "guild1" },
      },
      { upsert: true }
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/anti-raid");
  });

  it.each([
    ["a window above 300", "antiRaidJoinWindow", "3600", 300],
    ["a window of 301", "antiRaidJoinWindow", "301", 300],
    ["a window below 3", "antiRaidJoinWindow", "1", 3],
    ["a threshold of 1", "antiRaidJoinThreshold", "1", 2],
    ["a threshold above 100", "antiRaidJoinThreshold", "500", 100],
  ])("clamps %s to the range /antiraid config allows", async (_label, field, value, expected) => {
    const formData = new FormData();
    formData.set(field, value);

    await updateAntiRaidSettings("guild1", formData);

    expect(findOneAndUpdate.mock.calls[0][1].$set[field]).toBe(expected);
  });

  it.each([
    ["antiRaidJoinWindow", "3", 3],
    ["antiRaidJoinWindow", "300", 300],
    ["antiRaidJoinThreshold", "2", 2],
    ["antiRaidJoinThreshold", "100", 100],
  ])("keeps %s = %s, which is inside the range", async (field, value, expected) => {
    const formData = new FormData();
    formData.set(field, value);

    await updateAntiRaidSettings("guild1", formData);

    expect(findOneAndUpdate.mock.calls[0][1].$set[field]).toBe(expected);
  });

  it("ignores a negative or non-numeric threshold and falls back to default", async () => {
    const formData = new FormData();
    formData.set("antiRaidJoinThreshold", "-5");

    await updateAntiRaidSettings("guild1", formData);

    const update = findOneAndUpdate.mock.calls[0][1].$set;
    expect(update.antiRaidJoinThreshold).toBe(10);
  });
});
