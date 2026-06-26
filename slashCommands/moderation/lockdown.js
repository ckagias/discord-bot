const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Lock or unlock the current channel so no one can send messages.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName('lock')
                .setDescription('Prevent everyone from sending messages in this channel.')
                .addStringOption(o =>
                    o.setName('reason')
                        .setDescription('Optional reason shown in the channel notice.')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Restore normal messaging permissions in this channel.')),

    permissions: PermissionFlagsBits.ManageChannels,

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { channel, guild } = interaction;
        const sub = interaction.options.getSubcommand();
        const everyoneRole = guild.roles.everyone;

        if (!channel.permissionOverwrites) {
            return interaction.editReply({ content: 'This channel type does not support permission overwrites.' });
        }

        if (sub === 'lock') {
            const reason = interaction.options.getString('reason');

            const existing = channel.permissionOverwrites.cache.get(everyoneRole.id);
            if (existing?.deny.has(PermissionFlagsBits.SendMessages)) {
                return interaction.editReply({ content: 'This channel is already locked.' });
            }

            await channel.permissionOverwrites.edit(
                everyoneRole,
                { SendMessages: false },
                { reason: `Channel lockdown by ${interaction.user.tag}${reason ? `: ${reason}` : ''}` }
            );

            const notice = `🔒 This channel has been locked by a moderator.${reason ? ` **Reason:** \`${reason}\`` : ''}`;

            await interaction.editReply({ content: `🔒 ${channel} is now locked.` });
            await interaction.followUp({ content: notice });
        }

        if (sub === 'remove') {
            const existing = channel.permissionOverwrites.cache.get(everyoneRole.id);
            if (!existing?.deny.has(PermissionFlagsBits.SendMessages)) {
                return interaction.editReply({ content: 'This channel is not locked.' });
            }

            await channel.permissionOverwrites.edit(
                everyoneRole,
                { SendMessages: null },
                { reason: `Channel lockdown removed by ${interaction.user.tag}` }
            );

            await interaction.editReply({ content: `🔓 ${channel} has been unlocked.` });
            await interaction.followUp({ content: '🔓 This channel has been unlocked.' });
        }
    },
};
