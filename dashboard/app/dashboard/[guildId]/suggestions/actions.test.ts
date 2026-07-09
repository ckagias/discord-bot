import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { findOneAndDelete } = vi.hoisted(() => ({ findOneAndDelete: vi.fn() }));
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/models/Suggestion", () => ({ default: { findOneAndDelete } }));
vi.mock("@/lib/session", () => ({ getSession }));

function jsonResponse(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("suggestion actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    requireGuildAccess.mockResolvedValue(undefined);
    getSession.mockResolvedValue({ userId: "staff1" });
  });

  describe("approveSuggestion", () => {
    it("checks guild access first", async () => {
      requireGuildAccess.mockRejectedValue(new Error("forbidden"));
      const { approveSuggestion } = await import("./actions");

      await expect(approveSuggestion("guild1", "msg1")).rejects.toThrow("forbidden");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("calls the bot with the approved status and staff id, then revalidates", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200));
      const { approveSuggestion } = await import("./actions");

      const result = await approveSuggestion("guild1", "msg1");

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/internal/suggestion/status"),
        expect.objectContaining({
          body: JSON.stringify({ guildId: "guild1", messageId: "msg1", status: "approved", staffId: "staff1" }),
        })
      );
      expect(result).toEqual({});
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/suggestions");
    });

    it("returns an error when the bot responds with an error status", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { message: "not found" }));
      const { approveSuggestion } = await import("./actions");

      const result = await approveSuggestion("guild1", "msg1");

      expect(result.error).toMatch(/404/);
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("denySuggestion / implementSuggestion", () => {
    it("send the corresponding status", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200));
      const { denySuggestion, implementSuggestion } = await import("./actions");

      await denySuggestion("guild1", "msg1");
      expect(fetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ body: expect.stringContaining('"status":"denied"') })
      );

      await implementSuggestion("guild1", "msg1");
      expect(fetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ body: expect.stringContaining('"status":"implemented"') })
      );
    });
  });

  describe("deleteSuggestion", () => {
    it("checks guild access first", async () => {
      requireGuildAccess.mockRejectedValue(new Error("forbidden"));
      const { deleteSuggestion } = await import("./actions");

      await expect(deleteSuggestion("guild1", "msg1")).rejects.toThrow("forbidden");
      expect(findOneAndDelete).not.toHaveBeenCalled();
    });

    it("deletes the suggestion directly from the DB and revalidates", async () => {
      findOneAndDelete.mockResolvedValue({});
      const { deleteSuggestion } = await import("./actions");

      const result = await deleteSuggestion("guild1", "msg1");

      expect(findOneAndDelete).toHaveBeenCalledWith({ guildId: "guild1", messageId: "msg1" });
      expect(result).toEqual({});
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/suggestions");
    });

    it("returns an error instead of throwing when the DB call fails", async () => {
      findOneAndDelete.mockRejectedValue(new Error("db down"));
      const { deleteSuggestion } = await import("./actions");

      const result = await deleteSuggestion("guild1", "msg1");

      expect(result.error).toBe("db down");
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
