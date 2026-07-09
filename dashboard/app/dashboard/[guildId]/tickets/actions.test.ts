import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndUpdate } = vi.hoisted(() => ({ findOneAndUpdate: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Guild", () => ({ default: { findOneAndUpdate } }));

import { updateTicketSettings } from "./actions";

describe("updateTicketSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGuildAccess.mockResolvedValue(undefined);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateTicketSettings("guild1", new FormData())).rejects.toThrow("forbidden");
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("persists ticketCategoryId and ticketSupportRoleId and revalidates", async () => {
    const formData = new FormData();
    formData.set("ticketCategoryId", "cat1");
    formData.set("ticketSupportRoleId", "role1");

    await updateTicketSettings("guild1", formData);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild1" },
      { ticketCategoryId: "cat1", ticketSupportRoleId: "role1" },
      { upsert: true }
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/tickets");
  });
});
