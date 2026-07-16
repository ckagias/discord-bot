import { MessageFlags, ModalSubmitInteraction } from 'discord.js';
import HangmanGame from '../../models/HangmanSchema';
import { buildEmbed, buildRow, MAX_WRONG, REWARD } from '../../utils/hangman';
import { updateBalance } from '../../utils/economy';
import { ComponentDefinition } from '../../types/discord';

const component: ComponentDefinition = {
    type: 'modal',
    prefix: 'hangman_modal_',

    async execute(interaction: ModalSubmitInteraction) {
        const messageId = interaction.customId.replace('hangman_modal_', '');
        const game = await HangmanGame.findOne({ messageId });
        if (!game) return interaction.reply({ content: 'Game not found.', flags: MessageFlags.Ephemeral });
        if (game.finished) return interaction.reply({ content: 'This game is already over.', flags: MessageFlags.Ephemeral });
        if (game.userId !== interaction.user.id) return interaction.reply({ content: 'This is not your game!', flags: MessageFlags.Ephemeral });

        const letter = interaction.fields.getTextInputValue('letter').toLowerCase();

        if (!/^[a-z]$/.test(letter)) {
            return interaction.reply({ content: 'Please enter a single English letter.', flags: MessageFlags.Ephemeral });
        }

        if (game.guessed.includes(letter)) {
            return interaction.reply({ content: `You already guessed **${letter.toUpperCase()}**!`, flags: MessageFlags.Ephemeral });
        }

        game.guessed.push(letter);
        if (!game.word.includes(letter)) game.wrong += 1;

        const allRevealed = game.word.split('').every(l => game.guessed.includes(l));
        const outOfLives = game.wrong >= MAX_WRONG;

        let reward = null;
        if (allRevealed) {
            game.won = true;
            game.finished = true;
            reward = REWARD;
            await updateBalance(game.userId, game.guildId, reward);
        } else if (outOfLives) {
            game.finished = true;
        }

        await game.save();

        await (interaction as any).update({
            embeds: [buildEmbed(game, { reward })],
            components: [buildRow(game.finished)],
        });
    },
};

export = component;
