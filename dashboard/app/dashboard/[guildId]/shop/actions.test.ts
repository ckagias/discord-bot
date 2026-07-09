import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireGuildAccess } = vi.hoisted(() => ({ requireGuildAccess: vi.fn() }));
const { connectDB } = vi.hoisted(() => ({ connectDB: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { find, updateOne, insertMany, deleteMany, lean } = vi.hoisted(() => ({
  find: vi.fn(),
  updateOne: vi.fn(),
  insertMany: vi.fn(),
  deleteMany: vi.fn(),
  lean: vi.fn(),
}));

vi.mock("@/lib/authorize", () => ({ requireGuildAccess }));
vi.mock("@/lib/db", () => ({ connectDB }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("node:crypto", () => ({ randomUUID: vi.fn(() => "generated-uuid") }));
vi.mock("@/lib/models/Shop", () => ({
  default: { find, updateOne, insertMany, deleteMany },
}));

import { updateShop } from "./actions";

function itemsFormData(items: unknown[]): FormData {
  const formData = new FormData();
  formData.set("shop", JSON.stringify(items));
  return formData;
}

describe("updateShop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGuildAccess.mockResolvedValue(undefined);
    updateOne.mockResolvedValue(undefined);
    insertMany.mockResolvedValue(undefined);
    deleteMany.mockResolvedValue(undefined);
    find.mockReturnValue({ lean });
    lean.mockResolvedValue([]);
  });

  it("checks guild access before writing", async () => {
    requireGuildAccess.mockRejectedValue(new Error("forbidden"));

    await expect(updateShop("guild1", itemsFormData([]))).rejects.toThrow("forbidden");
    expect(find).not.toHaveBeenCalled();
  });

  it("throws on invalid JSON", async () => {
    const formData = new FormData();
    formData.set("shop", "not json");

    await expect(updateShop("guild1", formData)).rejects.toThrow(/Invalid shop data/);
  });

  it("throws when an item is missing a valid name/price/type", async () => {
    const formData = itemsFormData([
      { name: "", price: 10, type: "role", roleId: "r1" },
    ]);

    await expect(updateShop("guild1", formData)).rejects.toThrow(/Invalid item data/);
  });

  it("throws when a role item has no roleId", async () => {
    const formData = itemsFormData([
      { name: "Cool Role", price: 10, type: "role", roleId: null },
    ]);

    await expect(updateShop("guild1", formData)).rejects.toThrow(/no roleId/);
  });

  it("throws when a badge item has no emoji", async () => {
    const formData = itemsFormData([
      { name: "Cool Badge", price: 10, type: "badge", emoji: "  " },
    ]);

    await expect(updateShop("guild1", formData)).rejects.toThrow(/no emoji/);
  });

  it("throws when two items in the payload share the same name", async () => {
    const formData = itemsFormData([
      { name: "Same", price: 10, type: "badge", emoji: "🏅" },
      { name: "same", price: 20, type: "badge", emoji: "🎖️" },
    ]);

    await expect(updateShop("guild1", formData)).rejects.toThrow(/same name/);
  });

  it("throws when a name collides with an existing DB item", async () => {
    lean.mockResolvedValue([{ name: "Existing Item" }]);
    const formData = itemsFormData([
      { name: "Existing Item", price: 10, type: "badge", emoji: "🏅" },
    ]);

    await expect(updateShop("guild1", formData)).rejects.toThrow(/Duplicate item name/);
  });

  it("inserts new items with a generated itemId", async () => {
    const formData = itemsFormData([
      { name: "New Item", price: 10, type: "badge", emoji: "🏅", enabled: true },
    ]);

    await updateShop("guild1", formData);

    expect(insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ itemId: "generated-uuid", guildId: "guild1", name: "New Item" }),
    ]);
  });

  it("updates existing items in place by itemId", async () => {
    const formData = itemsFormData([
      {
        itemId: "existing-1",
        name: "Updated Item",
        price: 15,
        type: "role",
        roleId: "r1",
        enabled: true,
      },
    ]);

    await updateShop("guild1", formData);

    expect(updateOne).toHaveBeenCalledWith(
      { guildId: "guild1", itemId: "existing-1" },
      {
        $set: expect.objectContaining({ name: "Updated Item", price: 15, roleId: "r1" }),
      }
    );
    expect(insertMany).not.toHaveBeenCalled();
  });

  it("deletes items no longer present in the payload and revalidates", async () => {
    const formData = itemsFormData([
      { itemId: "keep-me", name: "Kept", price: 10, type: "badge", emoji: "🏅" },
    ]);

    await updateShop("guild1", formData);

    expect(deleteMany).toHaveBeenCalledWith({
      guildId: "guild1",
      itemId: { $nin: ["keep-me"] },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/guild1/shop");
  });
});
