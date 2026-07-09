import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getIronSession } = vi.hoisted(() => ({ getIronSession: vi.fn() }));
const { cookies } = vi.hoisted(() => ({ cookies: vi.fn() }));

vi.mock("iron-session", () => ({ getIronSession }));
vi.mock("next/headers", () => ({ cookies }));

describe("getSession", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    cookies.mockResolvedValue({});
    getIronSession.mockResolvedValue({ userId: "u1" });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when SESSION_SECRET is missing", async () => {
    delete process.env.SESSION_SECRET;
    const { getSession } = await import("@/lib/session");

    await expect(getSession()).rejects.toThrow(/SESSION_SECRET/);
  });

  it("throws when SESSION_SECRET is shorter than 32 characters", async () => {
    process.env.SESSION_SECRET = "short-secret";
    const { getSession } = await import("@/lib/session");

    await expect(getSession()).rejects.toThrow(/SESSION_SECRET/);
  });

  it("resolves a session when SESSION_SECRET is valid", async () => {
    process.env.SESSION_SECRET = "a".repeat(32);
    const { getSession } = await import("@/lib/session");

    await expect(getSession()).resolves.toEqual({ userId: "u1" });
    expect(getIronSession).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ cookieName: "dashboard_session" })
    );
  });

  it("marks the cookie secure in production", async () => {
    process.env.SESSION_SECRET = "a".repeat(32);
    process.env.NODE_ENV = "production";
    const { getSession } = await import("@/lib/session");

    await getSession();
    const options = getIronSession.mock.calls[0][1];
    expect(options.cookieOptions.secure).toBe(true);
  });

  it("marks the cookie insecure outside production", async () => {
    process.env.SESSION_SECRET = "a".repeat(32);
    process.env.NODE_ENV = "development";
    const { getSession } = await import("@/lib/session");

    await getSession();
    const options = getIronSession.mock.calls[0][1];
    expect(options.cookieOptions.secure).toBe(false);
  });
});
