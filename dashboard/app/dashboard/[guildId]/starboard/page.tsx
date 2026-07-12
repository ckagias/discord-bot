import { connectDB } from "@/lib/db";
import { fetchGuildChannels } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCardForm from "@/components/SettingsCardForm";
import { updateStarboardSettings } from "./actions";
import StarboardFields from "./StarboardFields";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
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
        <SettingsCardForm
          action={updateStarboardSettings.bind(null, guildId)}
          title="Settings"
          description="Starred messages that reach the threshold are reposted to the starboard channel."
        >
          <StarboardFields
            starboardEnabled={guild.starboardEnabled}
            starboardChannelId={guild.starboardChannelId}
            starboardEmoji={guild.starboardEmoji ?? "⭐"}
            starboardThreshold={guild.starboardThreshold ?? 3}
            starboardIgnoreNsfw={guild.starboardIgnoreNsfw ?? true}
            textChannels={textChannels}
          />
        </SettingsCardForm>
      </div>
    </>
  );
}
