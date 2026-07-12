"use client";

import { useState } from "react";
import SettingsCard from "@/components/SettingsCard";
import { TextField, ToggleField } from "@/components/Field";

const STYLES = {
  filtersCard: (enabled: boolean) =>
    enabled ? "" : "pointer-events-none opacity-50",
};

export default function AutomodFilters({
  automodEnabled,
  automodBannedWords,
  automodSpam,
  automodMentions,
  automodMentionLimit,
  automodInvites,
}: {
  automodEnabled: boolean;
  automodBannedWords: boolean;
  automodSpam: boolean;
  automodMentions: boolean;
  automodMentionLimit: number;
  automodInvites: boolean;
}) {
  const [enabled, setEnabled] = useState(automodEnabled);

  return (
    <>
      <SettingsCard
        title="Auto-Moderation"
        description="Automatically act on messages that break your rules."
      >
        <ToggleField
          label="Enable auto-moderation"
          name="automodEnabled"
          defaultChecked={automodEnabled}
          onChange={setEnabled}
        />
      </SettingsCard>

      <SettingsCard
        title="Filters"
        description="Choose which checks run on every message."
        className={["rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-6 py-6 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)] transition-opacity", STYLES.filtersCard(enabled)].join(" ")}
      >
        <ToggleField
          label="Banned words"
          description="Block messages containing words from your list below."
          name="automodBannedWords"
          defaultChecked={automodBannedWords}
          disabled={!enabled}
        />
        <ToggleField
          label="Spam / flood"
          description="Catch members sending messages too quickly."
          name="automodSpam"
          defaultChecked={automodSpam}
          disabled={!enabled}
        />
        <ToggleField
          label="Excessive mentions"
          description="Catch messages that mention too many users or roles at once."
          name="automodMentions"
          defaultChecked={automodMentions}
          disabled={!enabled}
        />
        <TextField
          label="Mention limit"
          description="Maximum mentions allowed in a single message."
          name="automodMentionLimit"
          defaultValue={String(automodMentionLimit)}
          disabled={!enabled}
        />
        <ToggleField
          label="Invite links"
          description="Block Discord invite links from non-staff members."
          name="automodInvites"
          defaultChecked={automodInvites}
          disabled={!enabled}
        />
      </SettingsCard>
    </>
  );
}
