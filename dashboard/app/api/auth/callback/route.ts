import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, fetchCurrentUser } from "@/lib/discord";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const BASE_URL = process.env.DASHBOARD_URL;
  if (!BASE_URL) throw new Error("DASHBOARD_URL env var is not set");

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?error=invalid_state", BASE_URL));
  }

  try {
    const { access_token } = await exchangeCodeForToken(code);
    const user = await fetchCurrentUser(access_token);

    const session = await getSession();
    session.userId = user.id;
    session.accessToken = access_token;
    session.username = user.username;
    session.avatar = user.avatar;
    await session.save();

    return NextResponse.redirect(new URL("/dashboard", BASE_URL));
  } catch (err) {
    console.error("[OAuth callback]", err);
    return NextResponse.redirect(new URL("/?error=auth_failed", BASE_URL));
  }
}