import { connectDB } from "@/lib/db";
import { fetchGuildChannels } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCard from "@/components/SettingsCard";
import SectionForm from "@/components/SectionForm";
import { ChannelField, TextField, ToggleField } from "@/components/Field";
import { updateStarboardSettings } from "./actions";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-[var(--text)]",
  stack: "flex flex-col gap-8 max-w-xl",
};

const TEXT_CHANNEL_TYPE = 0;

export default async function StarboardPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [guildDoc, channels] = await Promise.all([
    Guild.findOne({ guildId }).lean<GuildDoc>(),
    fetchGuildChannels(guildId),
  ]);

  const textChannels = channels.filter((c) => c.type === TEXT_CHANNEL_TYPE);

  const guild: Pick<
    GuildDoc,
    | "starboardEnabled"
    | "starboardChannelId"
    | "starboardEmoji"
    | "starboardThreshold"
    | "starboardIgnoreNsfw"
  > = guildDoc ?? {
    starboardEnabled: false,
    starboardChannelId: null,
    starboardEmoji: "⭐",
    starboardThreshold: 3,
    starboardIgnoreNsfw: true,
  };

  return (
    <>
      <h1 className={STYLES.heading}>Starboard</h1>
      <div className={STYLES.stack}>
        <SectionForm action={updateStarboardSettings.bind(null, guildId)}>
          <SettingsCard
            title="Settings"
            description="Starred messages that reach the threshold are reposted to the starboard channel."
          >
            <ToggleField
              label="Enable starboard"
              name="starboardEnabled"
              defaultChecked={guild.starboardEnabled}
            />
            <ChannelField
              label="Starboard channel"
              description="The channel where starred messages will be reposted."
              name="starboardChannelId"
              defaultValue={guild.starboardChannelId}
              channels={textChannels}
            />
            <TextField
              label="Star emoji"
              description="The emoji members react with to star a message. Default: ⭐"
              name="starboardEmoji"
              defaultValue={guild.starboardEmoji ?? "⭐"}
            />
            <TextField
              label="Threshold"
              description="Minimum number of star reactions needed to post to the starboard."
              name="starboardThreshold"
              defaultValue={String(guild.starboardThreshold ?? 3)}
            />
            <ToggleField
              label="Ignore NSFW channels"
              description="Messages from NSFW-marked channels will not appear on the starboard."
              name="starboardIgnoreNsfw"
              defaultChecked={guild.starboardIgnoreNsfw ?? true}
            />
          </SettingsCard>
        </SectionForm>
      </div>
    </>
  );
}
