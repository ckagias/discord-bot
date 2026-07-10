import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  accessToken?: string;
  username?: string;
  avatar?: string | null;
}

function getSessionOptions(): SessionOptions {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long");
  }

  return {
    password: process.env.SESSION_SECRET,
    cookieName: "dashboard_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}