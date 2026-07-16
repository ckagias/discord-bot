import fs from 'fs';
import path from 'path';
import { Client } from 'discord.js';
import log from '../utils/log';
const logger = log.scope('eventHandler');

interface BotEvent {
    name: string;
    once?: boolean;
    execute: (...args: any[]) => unknown;
}

export = (client: Client) => {
    const eventsPath = path.join(__dirname, '../events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        let event: BotEvent;
        try {
            event = require(path.join(eventsPath, file));
        } catch (err) {
            logger.error(`Failed to load ${file}:`, err);
            continue;
        }

        const listener = (...args: unknown[]) => {
            try {
                Promise.resolve(event.execute(...args, client))
                    .catch(err => logger.error(`Unhandled error in ${event.name}:`, err));
            } catch (err) {
                logger.error(`Unhandled error in ${event.name}:`, err);
            }
        };

        if (event.once) {
            client.once(event.name, listener);
        } else {
            client.on(event.name, listener);
        }
    }
};
