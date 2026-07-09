import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("mongoose", () => ({
  default: {
    connect: vi.fn().mockResolvedValue("connection"),
  },
}));

describe("connectDB", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete (global as { __mongooseConn?: unknown }).__mongooseConn;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when MONGODB_URL is missing", async () => {
    delete process.env.MONGODB_URL;
    const { connectDB } = await import("@/lib/db");

    expect(() => connectDB()).toThrow(/MONGODB_URL/);
  });

  it("connects using MONGODB_URL and caches the connection globally", async () => {
    process.env.MONGODB_URL = "mongodb://localhost/test";
    const mongoose = (await import("mongoose")).default;
    const { connectDB } = await import("@/lib/db");

    connectDB();
    connectDB();

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
    expect(mongoose.connect).toHaveBeenCalledWith("mongodb://localhost/test");
  });
});
