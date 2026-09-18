# Music & Lavalink

Music playback runs through Lavalink (`lavalink-client`), with state persisted to MongoDB so a bot restart doesn't kill an active session.

## Why persistence matters

Lavalink holds queue/player state in the node's memory by default. If the bot process restarts (`restart.sh --bot`), the in-memory state is gone unless something restores it. `utils/musicPersistence.ts` covers the three pieces of state that need to survive a restart.

## Components (`utils/musicPersistence.ts`)

### `MongoQueueStore`

Implements `QueueStoreManager` from `lavalink-client`. Must be a class, since the library checks the implementation via `Object.getPrototypeOf`. Backs `get`/`set`/`delete`/`stringify`/`parse` with `MusicQueueSchema`: one document per guild, a single serialized `data` string, upserted through `upsertWithRetry`.

### `saveMusicPlayer` / `getMusicPlayer` / `deleteMusicPlayer`

Persist player metadata (`nodeId`, `voiceChannelId`, `textChannelId`, `selfDeaf`/`selfMute`, `requesterId`) to `MusicPlayerSchema`. Lavalink doesn't track this itself, it's used to know which voice channel and player config to reconnect to after a restart.

### `getSavedSessionId` / `saveSessionId`

Persist the Lavalink node's session id to `LavalinkSessionSchema`, keyed by `nodeId` (unique). Lets the bot reattach to the same Lavalink session on reconnect instead of starting fresh, which is what makes session resume work.

## How a restart survives

1. `restart.sh --bot` rebuilds and restarts the bot container. Lavalink itself isn't restarted.
2. Lavalink is configured (via `LAVALINK_RESUME_TIMEOUT_MS`) to keep a guild's player alive for a window after the bot disconnects, instead of dropping it immediately.
3. On reconnect, the bot loads the saved session id and reattaches to the same Lavalink session within that window.
4. Player state and queue are restored from `MusicPlayerSchema` and `MusicQueueSchema`.

If the bot is down longer than `LAVALINK_RESUME_TIMEOUT_MS`, Lavalink drops the player and playback stops, even though the Mongo-backed queue data still exists.

## Related files

- `handlers/lavalinkHandler.ts`: wires up the Lavalink manager/node event handling
- `lavalink/application.yml`: node config for the Docker service
- `lavalink/plugins/`: bundled YouTube source plugin
- `slashCommands/music/*`: command surface (see [Commands Reference](commands.md))
- `LAVALINK_RESUME_TIMEOUT_MS`, `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`: see [Environment & Configuration](environment.md)
