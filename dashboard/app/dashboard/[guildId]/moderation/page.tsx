import { connectDB } from "@/lib/db";
import { fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCard from "@/components/SettingsCard";
import SectionForm from "@/components/SectionForm";
import { RoleField } from "@/components/Field";
import { updateModerationSettings } from "./actions";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-[var(--text)]",
  stack: "flex flex-col gap-8 max-w-xl",
};

export default async function ModerationSettingsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [guildDoc, roles] = await Promise.all([
    Guild.findOne({ guildId }).lean<GuildDoc>(),
    fetchGuildRoles(guildId),
  ]);

  const assignableRoles = roles.filter((r) => r.id !== guildId && !r.managed);

  const guild: Pick<GuildDoc, "muteRoleId" | "autoroleId"> = guildDoc ?? {
    muteRoleId: null,
    autoroleId: null,
  };

  return (
    <>
      <h1 className={STYLES.heading}>Moderation</h1>
      <div className={STYLES.stack}>
        <SectionForm action={updateModerationSettings.bind(null, guildId)}>
          <SettingsCard
            title="Mute role"
            description="Role applied to members muted by moderation commands."
          >
            <RoleField
              name="muteRoleId"
              defaultValue={guild.muteRoleId}
              roles={roles}
            />
          </SettingsCard>
          <SettingsCard
            title="Autorole"
            description="Role automatically assigned to every new member when they join."
          >
            <RoleField
              name="autoroleId"
              defaultValue={guild.autoroleId}
              roles={assignableRoles}
            />
          </SettingsCard>
        </SectionForm>
      </div>
    </>
  );
}
