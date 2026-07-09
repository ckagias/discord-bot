import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn(),
}));

vi.mock("mongoose", () => ({
  default: {
    connection: { readyState: 0 },
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when mongo is connected", async () => {
    const mongoose = (await import("mongoose")).default;
    mongoose.connection.readyState = 1;
    const { GET } = await import("../route");

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mongo: "up" });
  });

  it("returns 503 when mongo is not connected", async () => {
    const mongoose = (await import("mongoose")).default;
    mongoose.connection.readyState = 0;
    const { GET } = await import("../route");

    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ mongo: "down" });
  });

  it("returns 503 when connectDB throws", async () => {
    const { connectDB } = await import("@/lib/db");
    (connectDB as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("connect failed"));
    const { GET } = await import("../route");

    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ mongo: "down" });
  });
});
