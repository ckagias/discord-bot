const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    const eventsPath = path.join(__dirname, '../events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        let event;
        try {
            event = require(path.join(eventsPath, file));
        } catch (err) {
            console.error(`[eventHandler] Failed to load ${file}:`, err);
            continue;
        }

        const listener = (...args) => {
            try {
                Promise.resolve(event.execute(...args, client))
                    .catch(err => console.error(`[eventHandler] Unhandled error in ${event.name}:`, err));
            } catch (err) {
                console.error(`[eventHandler] Unhandled error in ${event.name}:`, err);
            }
        };

        if (event.once) {
            client.once(event.name, listener);
        } else {
            client.on(event.name, listener);
        }
    }
};