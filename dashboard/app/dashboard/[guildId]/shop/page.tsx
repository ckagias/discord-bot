import { connectDB } from "@/lib/db";
import { fetchGuildRoles } from "@/lib/discord";
import Shop from "@/lib/models/Shop";
import type { ShopDoc } from "@/lib/models/Shop";
import ShopForm from "./ShopForm";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
};

export default async function ShopPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [docs, allRoles] = await Promise.all([
    Shop.find({ guildId }).lean<ShopDoc[]>(),
    fetchGuildRoles(guildId),
  ]);

  const roles = allRoles.filter((r) => r.id !== guildId && !r.managed);
  const initial = docs.map(({ guildId: _g, ...rest }) => rest);

  return (
    <>
      <h1 className={STYLES.heading}>Shop</h1>
      <ShopForm guildId={guildId} initial={initial} roles={roles} />
    </>
  );
}
