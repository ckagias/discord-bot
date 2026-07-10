import { connectDB } from "@/lib/db";
import Guild, { GuildDoc, WarnThreshold } from "@/lib/models/Guild";
import ThresholdsForm from "./ThresholdsForm";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-[var(--text)]",
};

export default async function ThresholdsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const guildDoc = await Guild.findOne({ guildId }).lean<GuildDoc>();
  const initial: WarnThreshold[] = guildDoc?.warnThresholds ?? [];

  return (
    <>
      <h1 className={STYLES.heading}>Warn Thresholds</h1>
      <ThresholdsForm guildId={guildId} initial={initial} />
    </>
  );
}
