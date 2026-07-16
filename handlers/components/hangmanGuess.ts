import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags, ButtonInteraction } from 'discord.js';
import HangmanGame from '../../models/HangmanSchema';
import { buildEmbed, buildRow } from '../../utils/hangman';
import { ComponentDefinition } from '../../types/discord';

const components: ComponentDefinition[] = [
    {
        type: 'button',
        id: 'hangman_guess',

        async execute(interaction: ButtonInteraction) {
            const game = await HangmanGame.findOne({ messageId: interaction.message.id });
            if (!game) return interaction.reply({ content: 'Game not found.', flags: MessageFlags.Ephemeral });
            if (game.userId !== interaction.user.id) return interaction.reply({ content: 'This is not your game!', flags: MessageFlags.Ephemeral });
            if (game.finished) return interaction.reply({ content: 'This game is already over.', flags: MessageFlags.Ephemeral });

            const modal = new ModalBuilder()
                .setCustomId(`hangman_modal_${interaction.message.id}`)
                .setTitle('Guess a Letter')
                .addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(
                        new TextInputBuilder()
                            .setCustomId('letter')
                            .setLabel('Enter a single letter')
                            .setStyle(TextInputStyle.Short)
                            .setMinLength(1)
                            .setMaxLength(1)
                            .setRequired(true)
                    )
                );

            await interaction.showModal(modal);
        },
    },
    {
        type: 'button',
        id: 'hangman_quit',

        async execute(interaction: ButtonInteraction) {
            const game = await HangmanGame.findOne({ messageId: interaction.message.id });
            if (!game) return interaction.reply({ content: 'Game not found.', flags: MessageFlags.Ephemeral });
            if (game.userId !== interaction.user.id) return interaction.reply({ content: 'This is not your game!', flags: MessageFlags.Ephemeral });
            if (game.finished) return interaction.reply({ content: 'This game is already over.', flags: MessageFlags.Ephemeral });

            game.finished = true;
            game.won = false;
            await game.save();

            await (interaction as any).update({
                embeds: [buildEmbed(game)],
                components: [buildRow(true)],
            });
        },
    },
];

export = components;
