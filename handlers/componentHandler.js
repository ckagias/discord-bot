const fs = require('fs');
const path = require('path');
const log = require('../utils/log');
const logger = log.scope('componentHandler');

module.exports = (client) => {
    client.components = {
        button: { byId: new Map(), prefixes: [] },
        modal: { byId: new Map(), prefixes: [] },
    };

    const componentsPath = path.join(__dirname, 'components');
    const files = fs.readdirSync(componentsPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
        const exported = require(path.join(componentsPath, file));
        const entries = Array.isArray(exported) ? exported : [exported];

        for (const entry of entries) {
            const bucket = client.components[entry.type];
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
};

// Resolves the handler for a given interaction type ('button' | 'modal') and customId,
// checking exact-id matches first, then prefix matches in registration order.
function resolveComponent(client, type, customId) {
    const bucket = client.components?.[type];
    if (!bucket) return null;

    const exact = bucket.byId.get(customId);
    if (exact) return exact;

    for (const [prefix, execute] of bucket.prefixes) {
        if (customId.startsWith(prefix)) return execute;
    }

    return null;
}

module.exports.resolveComponent = resolveComponent;
