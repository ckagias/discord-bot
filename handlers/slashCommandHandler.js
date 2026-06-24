const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    client.commands = new Map();

    const folders = fs.readdirSync(path.join(__dirname, '../slashCommands'));

    for (const folder of folders) {
        const commandsPath = path.join(__dirname, '../slashCommands', folder);
        const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

        for (const file of files) {
            const command = require(path.join(commandsPath, file));
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
            } else {
                console.warn(`[slashCommandHandler] ${file} is missing required "data" or "execute" property, skipping.`);
            }
        }
    }
};