import fs from 'fs';
import path from 'path';
import { Client } from 'discord.js';
import log from '../utils/log';
const logger = log.scope('slashCommandHandler');

export = (client: Client) => {
    client.commands = new Map();

    const folders = fs.readdirSync(path.join(__dirname, '../slashCommands'));

    for (const folder of folders) {
        const commandsPath = path.join(__dirname, '../slashCommands', folder);
        const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

        for (const file of files) {
            let command;
            try {
                command = require(path.join(commandsPath, file));
            } catch (err) {
                logger.error(`Failed to load ${file}:`, err);
                continue;
            }

            if (command.data && command.execute) {
                command.category = folder;
                client.commands.set(command.data.name, command);
            } else {
                logger.warn(`${file} is missing required "data" or "execute" property, skipping.`);
            }
        }
    }
};
