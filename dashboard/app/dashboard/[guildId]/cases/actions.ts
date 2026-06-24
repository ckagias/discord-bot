"use server";

import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import Case from "@/lib/models/Case";
import { revalidatePath } from "next/cache";

export async function deleteCase(guildId: string, caseId: number) {
  await requireGuildAccess(guildId);
  await connectDB();
  await Case.findOneAndDelete({ guildId, caseId });
  revalidatePath(`/dashboard/${guildId}/cases`);
}
