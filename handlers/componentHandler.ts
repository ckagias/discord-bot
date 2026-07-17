import fs from 'fs';
import path from 'path';
import { Client } from 'discord.js';
import log from '../utils/log';
import { ComponentDefinition, ComponentBucket } from '../types/discord';
const logger = log.scope('componentHandler');

function registerComponents(client: Client) {
    client.components = {
        button: { byId: new Map(), prefixes: [] },
        modal: { byId: new Map(), prefixes: [] },
    };

    const componentsPath = path.join(__dirname, 'components');
    const files = fs.readdirSync(componentsPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'));

    for (const file of files) {
        const exported = require(path.join(componentsPath, file));
        const entries: ComponentDefinition[] = Array.isArray(exported) ? exported : [exported];

        for (const entry of entries) {
            const bucket: ComponentBucket | undefined = client.components[entry.type];
            if (!bucket) {
                logger.warn(`${file} has unknown type "${entry.type}", skipping.`);
                continue;
            }

            if (entry.id) {
                bucket.byId.set(entry.id, entry.execute);
            } else if (entry.prefix) {
                bucket.prefixes.push([entry.prefix, entry.execute]);
            } else {
                logger.warn(`${file} is missing both "id" and "prefix", skipping.`);
            }
        }
    }
}

function resolveComponent(client: Client, type: 'button' | 'modal', customId: string) {
    const bucket = client.components?.[type];
    if (!bucket) return null;

    const exact = bucket.byId.get(customId);
    if (exact) return exact;

    for (const [prefix, execute] of bucket.prefixes) {
        if (customId.startsWith(prefix)) return execute;
    }

    return null;
}

export = Object.assign(registerComponents, { resolveComponent });
