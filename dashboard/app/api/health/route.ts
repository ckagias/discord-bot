import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

export async function GET() {
  try {
    await connectDB();
    const healthy = mongoose.connection.readyState === 1;
    return NextResponse.json(
      { mongo: healthy ? "up" : "down" },
      { status: healthy ? 200 : 503 }
    );
  } catch {
    return NextResponse.json({ mongo: "down" }, { status: 503 });
  }
}
