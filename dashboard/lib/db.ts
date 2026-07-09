import mongoose from "mongoose";

declare global {
  var __mongooseConn: Promise<typeof mongoose> | undefined;
}

export function connectDB() {
  if (!process.env.MONGODB_URL) {
    throw new Error("Missing required env var: MONGODB_URL");
  }

  if (!global.__mongooseConn) {
    global.__mongooseConn = mongoose.connect(process.env.MONGODB_URL);
  }

  return global.__mongooseConn;
}