import { connectDB } from "@/lib/db";
import { fetchGuildChannels } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCardForm from "@/components/SettingsCardForm";
import { ChannelField, TextField } from "@/components/Field";
import { updateWelcomeSettings } from "./actions";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
  form: "max-w-xl",
  divider: "border-t border-[var(--border-muted)]",
  sectionTitle: "text-sm font-semibold text-[var(--text)]",
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
      <SettingsCardForm
        action={updateWelcomeSettings.bind(null, guildId)}
        title="Welcome & Farewell"
        description="Greet new members and post a message when they leave."
        formClassName={STYLES.form}
      >
        <span className={STYLES.sectionTitle}>Welcome</span>
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

        <div className={STYLES.divider} />

        <span className={STYLES.sectionTitle}>Farewell</span>
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
      </SettingsCardForm>
    </>
  );
}
