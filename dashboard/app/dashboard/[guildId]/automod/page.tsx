import { connectDB } from "@/lib/db";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCard from "@/components/SettingsCard";
import SectionForm from "@/components/SectionForm";
import { SelectField, TextAreaField, TextField, ToggleField } from "@/components/Field";
import { updateAutomodSettings } from "./actions";

const STYLES = {
  heading: "mb-4 text-2xl font-semibold text-[var(--text)]",
  form: "flex flex-col gap-6",
  grid: "grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start",
  leftCol: "flex flex-col gap-6",
};

const ACTION_OPTIONS = [
  { value: "delete", label: "Delete message" },
  { value: "warn", label: "Delete + warn" },
  { value: "timeout", label: "Delete + timeout" },
];

const TIMEOUT_OPTIONS = [
  { value: "60", label: "60 seconds" },
  { value: "300", label: "5 minutes" },
  { value: "600", label: "10 minutes" },
  { value: "3600", label: "1 hour" },
  { value: "86400", label: "1 day" },
  { value: "604800", label: "1 week" },
];

type AutomodFields = Pick<
  GuildDoc,
  | "automodEnabled"
  | "automodBannedWords"
  | "automodSpam"
  | "automodMentions"
  | "automodInvites"
  | "automodAction"
  | "automodTimeoutSeconds"
  | "automodBannedWordList"
  | "automodMentionLimit"
>;

export default async function AutomodSettingsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const guildDoc = await Guild.findOne({ guildId }).lean<GuildDoc>();

  // guildDoc may predate the automod fields being added to the schema —
  // Mongoose defaults only apply to documents created after the schema changed,
  // so merge field-by-field instead of an all-or-nothing fallback.
  const guild: AutomodFields = {
    automodEnabled: guildDoc?.automodEnabled ?? false,
    automodBannedWords: guildDoc?.automodBannedWords ?? false,
    automodSpam: guildDoc?.automodSpam ?? false,
    automodMentions: guildDoc?.automodMentions ?? false,
    automodInvites: guildDoc?.automodInvites ?? false,
    automodAction: guildDoc?.automodAction ?? "delete",
    automodTimeoutSeconds: guildDoc?.automodTimeoutSeconds ?? 300,
    automodBannedWordList: guildDoc?.automodBannedWordList ?? [],
    automodMentionLimit: guildDoc?.automodMentionLimit ?? 5,
  };

  return (
    <>
      <h1 className={STYLES.heading}>Auto-Mod</h1>
      <SectionForm
        action={updateAutomodSettings.bind(null, guildId)}
        className={STYLES.form}
        contentClassName={STYLES.grid}
      >
        <div className={STYLES.leftCol}>
          <SettingsCard
            title="Auto-Moderation"
            description="Automatically act on messages that break your rules."
          >
            <ToggleField
              label="Enable auto-moderation"
              name="automodEnabled"
              defaultChecked={guild.automodEnabled}
            />
          </SettingsCard>

          <SettingsCard title="Filters" description="Choose which checks run on every message.">
            <ToggleField
              label="Banned words"
              description="Block messages containing words from your list below."
              name="automodBannedWords"
              defaultChecked={guild.automodBannedWords}
            />
            <ToggleField
              label="Spam / flood"
              description="Catch members sending messages too quickly."
              name="automodSpam"
              defaultChecked={guild.automodSpam}
            />
            <ToggleField
              label="Excessive mentions"
              description="Catch messages that mention too many users or roles at once."
              name="automodMentions"
              defaultChecked={guild.automodMentions}
            />
            <TextField
              label="Mention limit"
              description="Maximum mentions allowed in a single message."
              name="automodMentionLimit"
              defaultValue={String(guild.automodMentionLimit)}
            />
            <ToggleField
              label="Invite links"
              description="Block Discord invite links from non-staff members."
              name="automodInvites"
              defaultChecked={guild.automodInvites}
            />
          </SettingsCard>
        </div>

        <div className={STYLES.leftCol}>
          <SettingsCard title="Banned words" description="Comma or newline separated.">
            <TextAreaField
              label="Word list"
              name="automodBannedWordList"
              defaultValue={guild.automodBannedWordList.join("\n")}
              minHeightClassName="min-h-55.5"
            />
          </SettingsCard>

          <SettingsCard title="Action" description="What happens when a filter is triggered.">
            <SelectField
              label="Action"
              name="automodAction"
              defaultValue={guild.automodAction}
              options={ACTION_OPTIONS}
            />
            <SelectField
              label="Timeout duration"
              description="Used when the action above is set to Delete + timeout."
              name="automodTimeoutSeconds"
              defaultValue={String(guild.automodTimeoutSeconds)}
              options={TIMEOUT_OPTIONS}
            />
          </SettingsCard>
        </div>
      </SectionForm>
    </>
  );
}
