const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const slashCommandsDir = path.join(__dirname, '..', 'slashCommands');
const folders = fs.readdirSync(slashCommandsDir);

for (const folder of folders) {
    const folderPath = path.join(slashCommandsDir, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

    console.log(`Loading files from ${folder}:`, files);

    for (const file of files) {
        let command;
        try {
            command = require(path.join(folderPath, file));
        } catch (err) {
            console.error(`[cmd] Failed to load ${file}:`, err);
            continue;
        }

        if (command.data && command.execute) {
            commands.push(command.data.toJSON());
        } else {
            console.log(`[WARNING] ${file} is missing required "data" or "execute" property.`);
        }
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.Token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands...`);
        await rest.put(
            Routes.applicationCommands(process.env.ClientID),
            { body: commands }
        );
        console.log('✅ Commands registered successfully');
    } catch (error) {
        console.error(error);
    }
})();