module.exports = {
    // The name of the event this file listens for — 'interactionCreate' fires every time a user interacts with the bot
    name: `interactionCreate`,
    async execute (interaction, client) {
        // If the interaction is not a slash command, ignore it and stop
        // This prevents the bot from trying to handle button clicks or dropdowns as commands
        if (!interaction.isChatInputCommand()) return;

        // Look up the command by name in the client's commands collection
        const command = client.commands.get(interaction.commandName);
        // If no matching command is found, ignore the interaction and stop
        if (!command) return;

        try {
            // Run the command's execute function, passing the interaction and client
            await command.execute(interaction, client);
        } catch (error) {
            console.error(error);
            const payload = { content: '❌ Error executing command', ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(payload).catch(() => {});
            } else {
                await interaction.reply(payload).catch(() => {});
            }
        }
    }
};