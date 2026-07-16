import { MessageFlags, Interaction, Client } from 'discord.js';
const { resolveComponent } = require('../handlers/componentHandler');
const log = require('../utils/log');
const logger = log.scope('interactionCreate');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction: Interaction, client: Client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            if (command.permissions && !(interaction.member.permissions as any).has(command.permissions)) {
                return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
            }

            try {
                await (command.execute as any)(interaction, client);
            } catch (error) {
                logger.error(error);
                const payload = { content: 'Error executing command', flags: MessageFlags.Ephemeral };
                if (interaction.deferred || interaction.replied) {
                    await (interaction as any).editReply(payload).catch(() => {});
                } else {
                    await (interaction as any).reply(payload).catch(() => {});
                }
            }
            return;
        }

        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command?.autocomplete) await (command.autocomplete as any)(interaction).catch(() => {});
            return;
        }

        if (interaction.isModalSubmit()) {
            const handler = resolveComponent(client, 'modal', interaction.customId);
            if (handler) {
                try {
                    await handler(interaction);
                } catch (error) {
                    logger.error('Modal handler error:', error);
                    const payload = { content: 'Something went wrong processing your input.', flags: MessageFlags.Ephemeral };
                    if (interaction.deferred || interaction.replied) {
                        await (interaction as any).editReply(payload).catch(() => {});
                    } else {
                        await (interaction as any).reply(payload).catch(() => {});
                    }
                }
            }
            return;
        }

        if (interaction.isButton()) {
            const handler = resolveComponent(client, 'button', interaction.customId);
            if (handler) {
                try {
                    await handler(interaction);
                } catch (error) {
                    logger.error('Button handler error:', error);
                    const payload = { content: 'Something went wrong. Please try again.', flags: MessageFlags.Ephemeral };
                    if (interaction.deferred || interaction.replied) {
                        await (interaction as any).editReply(payload).catch(() => {});
                    } else {
                        await (interaction as any).reply(payload).catch(() => {});
                    }
                }
            }
        }
    }
};
