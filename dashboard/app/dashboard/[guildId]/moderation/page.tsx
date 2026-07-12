import { connectDB } from "@/lib/db";
import { fetchGuildChannels, fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCardForm from "@/components/SettingsCardForm";
import { ChannelField, RoleField } from "@/components/Field";
import { updateModerationSettings } from "./actions";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
  stack: "flex flex-col gap-8 max-w-xl",
};

const TEXT_CHANNEL_TYPE = 0;

export default async function ModerationSettingsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [guildDoc, roles, channels] = await Promise.all([
    Guild.findOne({ guildId }).lean<GuildDoc>(),
    fetchGuildRoles(guildId),
    fetchGuildChannels(guildId),
  ]);

  const assignableRoles = roles.filter((r) => r.id !== guildId && !r.managed);
  const textChannels = channels.filter((c) => c.type === TEXT_CHANNEL_TYPE);

  const guild: Pick<GuildDoc, "muteRoleId" | "autoroleId" | "logChannelId"> = guildDoc ?? {
    muteRoleId: null,
    autoroleId: null,
    logChannelId: null,
  };

  return (
    <>
      <h1 className={STYLES.heading}>Moderation</h1>
      <div className={STYLES.stack}>
        <SettingsCardForm
          action={updateModerationSettings.bind(null, guildId)}
          title="Moderation Settings"
          description="Configure logging, muting, and automatic role assignment."
        >
          <ChannelField
            label="Log channel"
            description="Where moderation and member events are posted."
            name="logChannelId"
            defaultValue={guild.logChannelId}
            channels={textChannels}
          />
          <RoleField
            label="Mute role"
            description="Role applied to members muted by moderation commands."
            name="muteRoleId"
            defaultValue={guild.muteRoleId}
            roles={roles}
          />
          <RoleField
            label="Autorole"
            description="Role automatically assigned to every new member when they join."
            name="autoroleId"
            defaultValue={guild.autoroleId}
            roles={assignableRoles}
          />
        </SettingsCardForm>
      </div>
    </>
  );
}
