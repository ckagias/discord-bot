import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  const BASE_URL = process.env.DASHBOARD_URL;
  if (!BASE_URL) throw new Error("DASHBOARD_URL env var is not set");

  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL("/", BASE_URL));
}