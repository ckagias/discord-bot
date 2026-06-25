import { connectDB } from "@/lib/db";
import Trigger from "@/lib/models/Trigger";
import type { TriggerDoc } from "@/lib/models/Trigger";
import TriggersForm from "./TriggersForm";

const STYLES = {
  heading: "mb-6 text-2xl font-semibold text-black dark:text-zinc-50",
};

export default async function TriggersPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  await connectDB();

  const docs = await Trigger.find({ guildId }).lean<TriggerDoc[]>();
  const initial = docs.map(({ guildId: _g, ...rest }) => rest);

  return (
    <>
      <h1 className={STYLES.heading}>Triggers</h1>
      <TriggersForm guildId={guildId} initial={initial} />
    </>
  );
}
