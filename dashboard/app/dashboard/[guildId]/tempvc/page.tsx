import { connectDB } from "@/lib/db";
import { fetchGuildChannels } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCardForm from "@/components/SettingsCardForm";
import { ChannelField } from "@/components/Field";
import { updateTempVcSettings } from "./actions";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
  stack: "flex flex-col gap-8",
};

export default async function TempVcPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [guildDoc, allChannels] = await Promise.all([
    Guild.findOne({ guildId }).lean<GuildDoc>(),
    fetchGuildChannels(guildId),
  ]);

  const guild: Pick<GuildDoc, "tempVcCategoryId"> = guildDoc ?? {
    tempVcCategoryId: null,
  };

  // Discord channel type 4 = GuildCategory
  const categories = allChannels.filter((c) => c.type === 4);

  return (
    <>
      <h1 className={STYLES.heading}>Temp Voice Channels</h1>
      <div className={STYLES.stack}>
        <SettingsCardForm
          action={updateTempVcSettings.bind(null, guildId)}
          title="Channel category"
          description="If unset, uses the same category as the member's current voice channel."
          formClassName="max-w-xl"
        >
          <ChannelField
            name="tempVcCategoryId"
            defaultValue={guild.tempVcCategoryId}
            channels={categories}
          />
        </SettingsCardForm>
      </div>
    </>
  );
}
