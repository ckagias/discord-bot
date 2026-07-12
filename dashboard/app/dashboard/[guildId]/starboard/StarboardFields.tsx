"use client";

import { useState } from "react";
import { ChannelField, TextField, ToggleField } from "@/components/Field";
import type { DiscordChannel } from "@/lib/discord";

const STYLES = {
  fieldsGroup: (enabled: boolean) =>
    [
      "flex flex-col gap-6 transition-opacity",
      enabled ? "" : "pointer-events-none opacity-50",
    ].join(" "),
};

export default function StarboardFields({
  starboardEnabled,
  starboardChannelId,
  starboardEmoji,
  starboardThreshold,
  starboardIgnoreNsfw,
  textChannels,
}: {
  starboardEnabled: boolean;
  starboardChannelId: string | null;
  starboardEmoji: string;
  starboardThreshold: number;
  starboardIgnoreNsfw: boolean;
  textChannels: DiscordChannel[];
}) {
  const [enabled, setEnabled] = useState(starboardEnabled);

  return (
    <>
      <ToggleField
        label="Enable starboard"
        name="starboardEnabled"
        defaultChecked={starboardEnabled}
        onChange={setEnabled}
      />
      <div className={STYLES.fieldsGroup(enabled)}>
        <ChannelField
          label="Starboard channel"
          description="The channel where starred messages will be reposted."
          name="starboardChannelId"
          defaultValue={starboardChannelId}
          channels={textChannels}
          disabled={!enabled}
        />
        <TextField
          label="Star emoji"
          description="The emoji members react with to star a message. Default: ⭐"
          name="starboardEmoji"
          defaultValue={starboardEmoji}
          disabled={!enabled}
        />
        <TextField
          label="Threshold"
          description="Minimum number of star reactions needed to post to the starboard."
          name="starboardThreshold"
          defaultValue={String(starboardThreshold)}
          disabled={!enabled}
        />
        <ToggleField
          label="Ignore NSFW channels"
          description="Messages from NSFW-marked channels will not appear on the starboard."
          name="starboardIgnoreNsfw"
          defaultChecked={starboardIgnoreNsfw}
          disabled={!enabled}
        />
      </div>
    </>
  );
}
