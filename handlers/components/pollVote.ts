const { buildEmbed, buildButtons } = require('../../slashCommands/fun/poll');
import { MessageFlags, ButtonInteraction } from 'discord.js';
import PollSchema from '../../models/PollSchema';
import { ComponentDefinition } from '../../types/discord';

const component: ComponentDefinition = {
    type: 'button',
    prefix: 'poll_vote_',

    async execute(interaction: ButtonInteraction) {
        const optionIndex = String(interaction.customId.replace('poll_vote_', ''));
        const userId = interaction.user.id;

        const before = await PollSchema.findOne({ messageId: interaction.message.id, ended: false });
        if (!before)
            return interaction.reply({ content: 'This poll has already ended.', flags: MessageFlags.Ephemeral });

        const previousIndex = [...before.votes.entries()].find(([, voters]) => voters.includes(userId))?.[0] ?? null;
        const toggled = previousIndex === optionIndex;
        const pollFilter = { messageId: interaction.message.id, ended: false };

        // A voter can only be in one option's array, so pulling from every key is safe and atomic
        const pullOps = Object.fromEntries(before.options.map((_, i) => [`votes.${i}`, userId]));
        let poll = await PollSchema.findOneAndUpdate(pollFilter, { $pull: pullOps }, { new: true });

        if (poll && !toggled)
            poll = await PollSchema.findOneAndUpdate(pollFilter, { $addToSet: { [`votes.${optionIndex}`]: userId } }, { new: true });

        if (!poll)
            return interaction.reply({ content: 'This poll has already ended.', flags: MessageFlags.Ephemeral });

        await interaction.reply({
            content: toggled ? 'Your vote has been removed.' : `You voted for ${poll.options[Number(optionIndex)]}.`,
            flags: MessageFlags.Ephemeral,
        });

        const updatedEmbed = buildEmbed(poll.question, poll.options, poll.votes, interaction.message.embeds[0]?.footer?.text?.split(' • ')[0].replace('Poll by ', '') ?? 'Unknown', poll.endsAt, false);
        await interaction.message.edit({ embeds: [updatedEmbed], components: [buildButtons(poll.options)] });
    },
};

export = component;
