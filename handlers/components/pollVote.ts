const { buildEmbed, buildButtons } = require('../../slashCommands/fun/poll');
import { MessageFlags, ButtonInteraction } from 'discord.js';
import PollSchema from '../../models/PollSchema';
import { ComponentDefinition } from '../../types/discord';

const component: ComponentDefinition = {
    type: 'button',
    prefix: 'poll_vote_',

    async execute(interaction: ButtonInteraction) {
        const optionIndex = String(interaction.customId.replace('poll_vote_', ''));
        const poll = await PollSchema.findOne({ messageId: interaction.message.id, ended: false });

        if (!poll)
            return interaction.reply({ content: 'This poll has already ended.', flags: MessageFlags.Ephemeral });

        const userId = interaction.user.id;
        const votes = poll.votes;

        // Remove user from any option they previously voted for
        let previousIndex: string | null = null;
        for (const [key, voters] of votes) {
            if (voters.includes(userId)) {
                previousIndex = key;
                votes.set(key, voters.filter(id => id !== userId));
                break;
            }
        }

        // If they voted for a different option, add them to the new one
        if (previousIndex !== optionIndex) {
            const current = votes.get(optionIndex) ?? [];
            current.push(userId);
            votes.set(optionIndex, current);
        }

        poll.markModified('votes');
        await poll.save();

        const toggled = previousIndex === optionIndex;
        await interaction.reply({
            content: toggled ? 'Your vote has been removed.' : `You voted for ${poll.options[Number(optionIndex)]}.`,
            flags: MessageFlags.Ephemeral,
        });

        const updatedEmbed = buildEmbed(poll.question, poll.options, poll.votes, interaction.message.embeds[0]?.footer?.text?.split(' • ')[0].replace('Poll by ', '') ?? 'Unknown', poll.endsAt, false);
        await interaction.message.edit({ embeds: [updatedEmbed], components: [buildButtons(poll.options)] });
    },
};

export = component;
