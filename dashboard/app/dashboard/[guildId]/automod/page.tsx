import { connectDB } from "@/lib/db";
import Guild, { GuildDoc } from "@/lib/models/Guild";
import SettingsCard from "@/components/SettingsCard";
import SectionForm from "@/components/SectionForm";
import { SelectField, TextAreaField } from "@/components/Field";
import { updateAutomodSettings } from "./actions";
import AutomodFilters from "./AutomodFilters";

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

  // guildDoc may predate these fields — Mongoose defaults only apply to new documents, so merge field-by-field.
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
          <AutomodFilters
            automodEnabled={guild.automodEnabled}
            automodBannedWords={guild.automodBannedWords}
            automodSpam={guild.automodSpam}
            automodMentions={guild.automodMentions}
            automodMentionLimit={guild.automodMentionLimit}
            automodInvites={guild.automodInvites}
          />
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
