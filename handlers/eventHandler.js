const fs = require('fs');
const path = require('path');
const log = require('../utils/log');
const logger = log.scope('eventHandler');

module.exports = (client) => {
    const eventsPath = path.join(__dirname, '../events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        let event;
        try {
            event = require(path.join(eventsPath, file));
        } catch (err) {
            logger.error(`Failed to load ${file}:`, err);
            continue;
        }

        const listener = (...args) => {
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