import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/discord";

export async function GET(req: NextRequest) {
  const state = randomBytes(16).toString("hex");
  const switchAccount = req.nextUrl.searchParams.get("switch") === "1";

  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthorizeUrl(state, switchAccount));
}