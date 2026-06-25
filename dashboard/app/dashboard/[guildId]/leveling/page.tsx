import { connectDB } from "@/lib/db";
import { fetchGuildChannels, fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCard from "@/components/SettingsCard";
import SectionForm from "@/components/SectionForm";
import { ChannelField, ToggleField } from "@/components/Field";
import { updateLevelingSettings } from "./actions";
import LevelRolesForm from "./LevelRolesForm";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-black dark:text-zinc-50",
  stack: "flex flex-col gap-8 max-w-xl",
};

const TEXT_CHANNEL_TYPE = 0;

export default async function LevelingPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [guildDoc, channels, allRoles] = await Promise.all([
    Guild.findOne({ guildId }).lean<GuildDoc>(),
    fetchGuildChannels(guildId),
    fetchGuildRoles(guildId),
  ]);

  const textChannels = channels.filter((c) => c.type === TEXT_CHANNEL_TYPE);
  const roles = allRoles.filter((r) => r.id !== guildId && !r.managed);

  const guild: Pick<GuildDoc, "levelingEnabled" | "levelUpChannelId" | "levelRoles"> = guildDoc ?? {
    levelingEnabled: false,
    levelUpChannelId: null,
    levelRoles: [],
  };

  return (
    <>
      <h1 className={STYLES.heading}>Leveling</h1>
      <div className={STYLES.stack}>
        <SectionForm action={updateLevelingSettings.bind(null, guildId)}>
          <SettingsCard title="Settings" description="Configure the XP leveling system for this server.">
            <ToggleField
              label="Enable leveling"
              name="levelingEnabled"
              defaultChecked={guild.levelingEnabled}
            />
            <ChannelField
              label="Level-up channel"
              description="Where level-up announcements are posted. Leave as None to post in the channel where the member chatted."
              name="levelUpChannelId"
              defaultValue={guild.levelUpChannelId}
              channels={textChannels}
            />
          </SettingsCard>
        </SectionForm>
        <LevelRolesForm guildId={guildId} initial={guild.levelRoles} roles={roles} />
      </div>
    </>
  );
}
