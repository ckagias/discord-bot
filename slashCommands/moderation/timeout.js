const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const DURATION_CHOICES = [
    { name: '60 seconds', value: 60 },
    { name: '5 minutes', value: 300 },
    { name: '10 minutes', value: 600 },
    { name: '1 hour', value: 3600 },
    { name: '1 day', value: 86400 },
    { name: '1 week', value: 604800 },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Manage member timeouts.')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Timeout a member, preventing them from sending messages.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to timeout')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('Timeout duration')
                        .setRequired(true)
                        .addChoices(...DURATION_CHOICES))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the timeout')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('edit')
                .setDescription('Change the duration of an active timeout.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The timed-out user')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('New timeout duration')
                        .setRequired(true)
                        .addChoices(...DURATION_CHOICES))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the change')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove an active timeout from a member.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The timed-out user')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the removal')
                        .setRequired(false))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    permissions: PermissionFlagsBits.ModerateMembers,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        if (!target) {
            return interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });
        }

        if (interaction.member.roles.highest.position <= target.roles.highest.position) {
            return interaction.reply({ content: 'You cannot manage the timeout of someone with an equal or higher role.', flags: MessageFlags.Ephemeral });
        }

        if (!target.moderatable) {
            return interaction.reply({ content: 'I cannot manage that user\'s timeout (check my role position).', flags: MessageFlags.Ephemeral });
        }

        if (sub === 'add' || sub === 'edit') {
            if (sub === 'edit' && !target.isCommunicationDisabled()) {
                return interaction.reply({ content: 'That user does not have an active timeout. Use `/timeout add` instead.', flags: MessageFlags.Ephemeral });
            }

            const duration = interaction.options.getInteger('duration');
            await target.timeout(duration * 1000, reason);

            const verb = sub === 'add' ? 'Timed out' : 'Updated timeout for';
            return interaction.reply({ content: `${verb} **${target.user.tag}** until <t:${Math.floor((Date.now() + duration * 1000) / 1000)}:R> for \`${reason}\`` });
        }

        if (sub === 'remove') {
            if (!target.isCommunicationDisabled()) {
                return interaction.reply({ content: 'That user does not have an active timeout.', flags: MessageFlags.Ephemeral });
            }

            await target.timeout(null, reason);
            return interaction.reply({ content: `Removed timeout from **${target.user.tag}** for \`${reason}\`` });
        }
    },
};
