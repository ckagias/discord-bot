const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a member, preventing them from sending messages.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to timeout')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Timeout duration')
                .setRequired(true)
                .addChoices(
                    { name: '60 seconds', value: 60 },
                    { name: '5 minutes',  value: 300 },
                    { name: '10 minutes', value: 600 },
                    { name: '1 hour',     value: 3600 },
                    { name: '1 day',      value: 86400 },
                    { name: '1 week',     value: 604800 },
                ))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the timeout')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getMember('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        if (!target) {
            return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
        }

        if (interaction.member.roles.highest.position <= target.roles.highest.position) {
            return interaction.reply({ content: 'You cannot timeout someone with an equal or higher role.', ephemeral: true });
        }

        if (!target.moderatable) {
            return interaction.reply({ content: 'I cannot timeout that user (check my role position).', ephemeral: true });
        }

        await target.timeout(duration * 1000, reason);
        return interaction.reply({ content: `Timed out **${target.user.tag}** until <t:${Math.floor((Date.now() + duration * 1000) / 1000)}:R> for \`${reason}\`` });
    },
};