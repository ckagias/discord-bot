"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireGuildAccess } from "@/lib/authorize";
import { connectDB } from "@/lib/db";
import { escapeRegex } from "@/lib/forms";
import Shop from "@/lib/models/Shop";

interface ShopRow {
  itemId?: string;
  name: string;
  description: string;
  price: number;
  type: "role" | "badge";
  roleId: string | null;
  emoji: string | null;
  enabled: boolean;
}

export async function updateShop(guildId: string, formData: FormData) {
  await requireGuildAccess(guildId);
  await connectDB();

  const raw = formData.get("shop")?.toString() ?? "[]";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid shop data.");
  }

  if (!Array.isArray(parsed)) throw new Error("Invalid shop data.");

  const rows: ShopRow[] = [];
  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof item.name !== "string" ||
      item.name.trim().length === 0 ||
      typeof item.price !== "number" ||
      !Number.isInteger(item.price) ||
      item.price < 1 ||
      (item.type !== "role" && item.type !== "badge")
    ) {
      throw new Error("Invalid item data — check name, price, and type.");
    }
    if (item.type === "role" && !item.roleId) {
      throw new Error(`Item "${item.name}" is type "role" but has no roleId.`);
    }
    if (item.type === "badge" && !item.emoji?.trim()) {
      throw new Error(`Item "${item.name}" is type "badge" but has no emoji.`);
    }
    rows.push({
      itemId:      typeof item.itemId === "string" && item.itemId ? item.itemId : undefined,
      name:        item.name.trim(),
      description: typeof item.description === "string" ? item.description.trim() : "",
      price:       item.price,
      type:        item.type,
      roleId:      item.type === "role" ? (item.roleId ?? null) : null,
      emoji:       item.type === "badge" ? (item.emoji?.trim() ?? null) : null,
      enabled:     item.enabled === true,
    });
  }

  const existingRows = rows.filter((r) => r.itemId);
  const newRows      = rows.filter((r) => !r.itemId);
  const keptItemIds  = existingRows.map((r) => r.itemId as string);

  // Check for duplicate names: new items must not collide with any existing DB
  // item; existing items must not collide with each other or other DB items
  // (exclude their own itemId from the match to allow renaming to same name).
  const allNames = rows.map((r) => r.name.toLowerCase());
  const hasDuplicateInPayload = allNames.length !== new Set(allNames).size;
  if (hasDuplicateInPayload) {
    throw new Error("Two or more items in the list share the same name.");
  }
  const dupes = await Shop.find({
    guildId,
    name: { $in: allNames.map((n) => new RegExp(`^${escapeRegex(n)}$`, "i")) },
    itemId: { $nin: keptItemIds },
  }).lean<{ name: string }[]>();
  if (dupes.length > 0) {
    throw new Error(
      `Duplicate item name(s): ${dupes.map((d) => d.name).join(", ")}`
    );
  }

  // Upsert existing items (preserves itemId so inventory ownership is intact)
  await Promise.all(
    existingRows.map((r) =>
      Shop.updateOne(
        { guildId, itemId: r.itemId },
        {
          $set: {
            name:        r.name,
            description: r.description,
            price:       r.price,
            type:        r.type,
            roleId:      r.roleId,
            emoji:       r.emoji,
            enabled:     r.enabled,
          },
        }
      )
    )
  );

  // Insert brand-new items and track their assigned IDs
  const newItemIds: string[] = [];
  if (newRows.length > 0) {
    const docs = newRows.map((r) => ({ ...r, itemId: randomUUID(), guildId }));
    newItemIds.push(...docs.map((d) => d.itemId));
    await Shop.insertMany(docs);
  }

  // Delete only items the admin removed (existing + newly inserted IDs are safe)
  const allKeptIds = [...keptItemIds, ...newItemIds];
  await Shop.deleteMany({ guildId, itemId: { $nin: allKeptIds } });

  revalidatePath(`/dashboard/${guildId}/shop`);
}
