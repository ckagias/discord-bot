import { connectDB } from "@/lib/db";
import { fetchGuildChannels } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCard from "@/components/SettingsCard";
import SectionForm from "@/components/SectionForm";
import { ChannelField, TextField } from "@/components/Field";
import { updateWelcomeSettings } from "./actions";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-[var(--text)]",
};

const TEXT_CHANNEL_TYPE = 0;

export default async function WelcomeSettingsPage({
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

  const guild: Pick<
    GuildDoc,
    "welcomeChannelId" | "welcomeMessage" | "farewellChannelId" | "farewellMessage"
  > = guildDoc ?? {
    welcomeChannelId: null,
    welcomeMessage: null,
    farewellChannelId: null,
    farewellMessage: null,
  };
  const textChannels = channels.filter((c) => c.type === TEXT_CHANNEL_TYPE);

  return (
    <>
      <h1 className={STYLES.heading}>Welcome & Farewell</h1>
      <SectionForm action={updateWelcomeSettings.bind(null, guildId)}>
        <SettingsCard title="Welcome" description="Greet new members when they join.">
          <ChannelField
            label="Welcome channel"
            name="welcomeChannelId"
            defaultValue={guild.welcomeChannelId}
            channels={textChannels}
          />
          <TextField
            label="Welcome message"
            description="Use {user} to mention the new member."
            name="welcomeMessage"
            defaultValue={guild.welcomeMessage}
          />
        </SettingsCard>
        <SettingsCard title="Farewell" description="Post a message when a member leaves.">
          <ChannelField
            label="Farewell channel"
            name="farewellChannelId"
            defaultValue={guild.farewellChannelId}
            channels={textChannels}
          />
          <TextField
            label="Farewell message"
            description="Use {user} to reference the member who left."
            name="farewellMessage"
            defaultValue={guild.farewellMessage}
          />
        </SettingsCard>
      </SectionForm>
    </>
  );
}
