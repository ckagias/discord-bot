import { connectDB } from "@/lib/db";
import { fetchGuildRoles } from "@/lib/discord";
import ReactionRole from "@/lib/models/ReactionRole";
import type { ReactionRoleDoc } from "@/lib/models/ReactionRole";
import ReactionRolesForm from "./ReactionRolesForm";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
};

export default async function ReactionRolesPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [docs, allRoles] = await Promise.all([
    ReactionRole.find({ guildId }).lean<ReactionRoleDoc[]>(),
    fetchGuildRoles(guildId),
  ]);

  const roles = allRoles.filter((r) => r.id !== guildId && !r.managed);
  const initial = docs.map(({ guildId: _g, ...rest }) => rest);

  return (
    <>
      <h1 className={STYLES.heading}>Reaction Roles</h1>
      <ReactionRolesForm guildId={guildId} initial={initial} roles={roles} />
    </>
  );
}
