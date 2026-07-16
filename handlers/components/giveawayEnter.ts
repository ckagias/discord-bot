import { EmbedBuilder, MessageFlags, ButtonInteraction } from 'discord.js';
import GiveawaySchema from '../../models/GiveawaySchema';
import log from '../../utils/log';
import { ComponentDefinition } from '../../types/discord';
const logger = log.scope('giveaway');

const component: ComponentDefinition = {
    type: 'button',
    id: 'giveaway_enter',

    async execute(interaction: ButtonInteraction) {
        const giveaway = await GiveawaySchema.findOne({ messageId: interaction.message.id, ended: false });

        if (!giveaway)
            return interaction.reply({ content: 'This giveaway has already ended.', flags: MessageFlags.Ephemeral });

        if (giveaway.requireRoleId) {
            const member = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);
            if (!member || !member.roles.cache.has(giveaway.requireRoleId)) {
                return interaction.reply({ content: `You need the <@&${giveaway.requireRoleId}> role to enter this giveaway.`, flags: MessageFlags.Ephemeral });
            }
        }

        const userId = interaction.user.id;
        const already = giveaway.entrants.includes(userId);

        const op = already
            ? { $pull: { entrants: userId } }
            : { $addToSet: { entrants: userId } };

        const updated = await GiveawaySchema.findOneAndUpdate(
            { messageId: interaction.message.id, ended: false },
            op,
            { new: true },
        );

        if (!updated) {
            return interaction.reply({ content: 'This giveaway has already ended.', flags: MessageFlags.Ephemeral });
        }

        await interaction.reply({
            content: already ? 'You have withdrawn from the giveaway.' : 'You have entered the giveaway! Click again to withdraw.',
            flags: MessageFlags.Ephemeral,
        });

        const currentEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(currentEmbed).spliceFields(3, 1, { name: 'Entries', value: `${updated.entrants.length}`, inline: true });
        await interaction.message.edit({ embeds: [updatedEmbed] })
            .catch(err => logger.error('Failed to update entry count on giveaway embed:', err));
    },
};

export = component;
