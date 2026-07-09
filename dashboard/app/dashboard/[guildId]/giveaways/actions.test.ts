import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndDelete } = vi.hoisted(() => ({ findOneAndDelete: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Giveaway", () => ({ default: { findOneAndDelete } }));

function jsonResponse(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("giveaway actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    requireGuildAccess.mockResolvedValue(undefined);
  });

  describe("endGiveaway", () => {
    it("checks guild access first", async () => {
      requireGuildAccess.mockRejectedValue(new Error("forbidden"));
      const { endGiveaway } = await import("./actions");

      await expect(endGiveaway("guild1", "msg1")).rejects.toThrow("forbidden");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("returns no error and revalidates on success", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200));
      const { endGiveaway } = await import("./actions");

      const result = await endGiveaway("guild1", "msg1");

      expect(result).toEqual({});
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/giveaways");
    });

    it("returns an error and does not revalidate when the bot responds with an error status", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { message: "not found" }));
      const { endGiveaway } = await import("./actions");

      const result = await endGiveaway("guild1", "msg1");

      expect(result.error).toMatch(/404/);
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("returns an error when the bot is unreachable", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));
      const { endGiveaway } = await import("./actions");

      const result = await endGiveaway("guild1", "msg1");

      expect(result.error).toMatch(/Could not reach bot/);
    });
  });

  describe("rerollGiveaway", () => {
    it("returns no error and revalidates on success", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200));
      const { rerollGiveaway } = await import("./actions");

      const result = await rerollGiveaway("guild1", "msg1");

      expect(result).toEqual({});
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/giveaways");
    });
  });

  describe("deleteGiveaway", () => {
    it("checks guild access first", async () => {
      requireGuildAccess.mockRejectedValue(new Error("forbidden"));
      const { deleteGiveaway } = await import("./actions");

      await expect(deleteGiveaway("guild1", "msg1")).rejects.toThrow("forbidden");
      expect(findOneAndDelete).not.toHaveBeenCalled();
    });

    it("deletes the giveaway directly from the DB and revalidates", async () => {
      findOneAndDelete.mockResolvedValue({});
      const { deleteGiveaway } = await import("./actions");

      const result = await deleteGiveaway("guild1", "msg1");

      expect(findOneAndDelete).toHaveBeenCalledWith({ guildId: "guild1", messageId: "msg1" });
      expect(result).toEqual({});
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/giveaways");
    });

    it("returns an error instead of throwing when the DB call fails", async () => {
      findOneAndDelete.mockRejectedValue(new Error("db down"));
      const { deleteGiveaway } = await import("./actions");

      const result = await deleteGiveaway("guild1", "msg1");

      expect(result.error).toBe("db down");
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
