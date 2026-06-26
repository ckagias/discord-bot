const { EmbedBuilder, MessageFlags } = require('discord.js');
const GiveawaySchema = require('../../models/GiveawaySchema');

module.exports = {
    type: 'button',
    id: 'giveaway_enter',

    async execute(interaction) {
        const giveaway = await GiveawaySchema.findOne({ messageId: interaction.message.id, ended: false });

        if (!giveaway)
            return interaction.reply({ content: 'This giveaway has already ended.', flags: MessageFlags.Ephemeral });

        if (giveaway.requireRoleId) {
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member || !member.roles.cache.has(giveaway.requireRoleId)) {
                return interaction.reply({ content: `You need the <@&${giveaway.requireRoleId}> role to enter this giveaway.`, flags: MessageFlags.Ephemeral });
            }
        }

        const userId = interaction.user.id;
        const already = giveaway.entrants.includes(userId);

        if (already) {
            giveaway.entrants = giveaway.entrants.filter(id => id !== userId);
            await giveaway.save();
            await interaction.reply({ content: 'You have withdrawn from the giveaway.', flags: MessageFlags.Ephemeral });
        } else {
            giveaway.entrants.push(userId);
            await giveaway.save();
            await interaction.reply({ content: 'You have entered the giveaway! Click again to withdraw.', flags: MessageFlags.Ephemeral });
        }

        const currentEmbed = interaction.message.embeds[0];
        const updated = EmbedBuilder.from(currentEmbed).spliceFields(3, 1, { name: 'Entries', value: `${giveaway.entrants.length}`, inline: true });
        await interaction.message.edit({ embeds: [updated] })
            .catch(err => console.error('[giveaway] Failed to update entry count on giveaway embed:', err));
    },
};
