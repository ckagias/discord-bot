import { connectDB } from "@/lib/db";
import { fetchGuildChannels, fetchGuildRoles } from "@/lib/discord";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCardForm from "@/components/SettingsCardForm";
import { ChannelField, RoleField, TextField } from "@/components/Field";
import { updateBirthdaySettings } from "./actions";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
};

const TEXT_CHANNEL_TYPE = 0;
// Keep in sync with utils/birthday.js's DEFAULT_BIRTHDAY_MESSAGE.
const DEFAULT_BIRTHDAY_MESSAGE = "Happy Birthday {user}! You turn {age} today! 🎉";

export default async function BirthdaySettingsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const [guildDoc, channels, roles] = await Promise.all([
    Guild.findOne({ guildId }).lean<GuildDoc>(),
    fetchGuildChannels(guildId),
    fetchGuildRoles(guildId),
  ]);

  const guild: Pick<GuildDoc, "birthdayChannelId" | "birthdayMessage" | "birthdayRoleId"> = guildDoc ?? {
    birthdayChannelId: null,
    birthdayMessage: null,
    birthdayRoleId: null,
  };
  const textChannels = channels.filter((c) => c.type === TEXT_CHANNEL_TYPE);
  const assignableRoles = roles.filter((r) => r.id !== guildId && !r.managed);

  return (
    <>
      <h1 className={STYLES.heading}>Birthdays</h1>
      <SettingsCardForm
        action={updateBirthdaySettings.bind(null, guildId)}
        title="Birthday Announcements"
        description="Members set their birthday with /birthday set. Announcements post daily for anyone whose birthday matches."
        formClassName="max-w-xl"
      >
        <ChannelField
          label="Announcement channel"
          name="birthdayChannelId"
          defaultValue={guild.birthdayChannelId}
          channels={textChannels}
        />
        <TextField
          label="Announcement message"
          description="Supports {user}, {server}, and {age} (if a birth year was given)."
          name="birthdayMessage"
          defaultValue={guild.birthdayMessage ?? DEFAULT_BIRTHDAY_MESSAGE}
        />
        <RoleField
          label="Birthday role"
          description="Optional. Granted for the day and automatically removed the next day."
          name="birthdayRoleId"
          defaultValue={guild.birthdayRoleId}
          roles={assignableRoles}
        />
      </SettingsCardForm>
    </>
  );
}
