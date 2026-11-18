import type { CollectedInteraction, InteractionCollector, ReadonlyCollection, Snowflake } from 'discord.js';
import log = require('./log');
const logger = log.scope('collector');

interface SafeCollectorHandlers<T extends CollectedInteraction> {
    onCollect?: (interaction: T) => unknown;
    onEnd?: (collected: ReadonlyCollection<Snowflake, T>, reason: string) => unknown;
}

// discord.js collectors are plain EventEmitters without `captureRejections`, unlike the client, so a rejected promise
// from an async 'collect' or 'end' handler (a deleted message, an expired interaction, a database error) becomes an
// unhandled rejection, and src/index.ts shuts the whole bot down on those. This registers the handlers with a
// try/catch around each one that logs the error instead.
//
// A handler is wrapped as a whole, so a failure stops that handler where it happened and nothing after it runs. Put
// anything that must always happen (such as refunding a held bet) before the Discord calls that can fail, and `await`
// those calls (or return them) so a rejection reaches this wrapper instead of floating.
function safeCollector<T extends CollectedInteraction>(
    collector: InteractionCollector<T>,
    { onCollect, onEnd }: SafeCollectorHandlers<T>,
    name = 'collector',
): InteractionCollector<T> {
    if (onCollect) {
        collector.on('collect', async (interaction) => {
            try {
                await onCollect(interaction);
            } catch (err) {
                logger.error(`${name}: error in collect handler:`, err);
            }
        });
    }

    if (onEnd) {
        collector.on('end', async (collected, reason) => {
            try {
                await onEnd(collected, reason);
            } catch (err) {
                logger.error(`${name}: error in end handler:`, err);
            }
        });
    }

    return collector;
}

export { safeCollector };
