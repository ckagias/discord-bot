const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const log = require('../utils/log');
const logger = log.scope('cmd');

const commands = [];
const slashCommandsDir = path.join(__dirname, '..', 'slashCommands');
const folders = fs.readdirSync(slashCommandsDir);

for (const folder of folders) {
    const folderPath = path.join(slashCommandsDir, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

    logger.info(`Loading files from ${folder}:`, files);

    for (const file of files) {
        let command;
        try {
            command = require(path.join(folderPath, file));
        } catch (err) {
            logger.error(`Failed to load ${file}:`, err);
            continue;
        }

        if (command.data && command.execute) {
            commands.push(command.data.toJSON());
        } else {
            logger.warn(`${file} is missing required "data" or "execute" property.`);
        }
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.Token);

(async () => {
    try {
        logger.info(`Started refreshing ${commands.length} application (/) commands...`);
        await rest.put(
            Routes.applicationCommands(process.env.ClientID),
            { body: commands }
        );
        logger.info('✅ Commands registered successfully');
    } catch (error) {
        logger.error(error);
    }
})();