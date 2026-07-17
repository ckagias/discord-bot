import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
const { updateGuildConfig, getGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Manage the role automatically assigned to new members.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set the role to assign to every new member on join.')
                .addRoleOption(o =>
                    o.setName('role')
                        .setDescription('Role to auto-assign.')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Disable autorole (stop assigning a role on join).'))
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('Show the current autorole setting.')),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { guild } = interaction;
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            const role = interaction.options.getRole('role');

            if (role.managed) {
                return interaction.editReply({ content: 'Bot-managed roles cannot be used as the autorole.' });
            }
            if (role.id === guild.id) {
                return interaction.editReply({ content: 'The @everyone role cannot be used as the autorole.' });
            }
            if (guild.members.me.roles.highest.position <= role.position) {
                return interaction.editReply({ content: `I can't assign ${role} — it's higher than or equal to my highest role.` });
            }

            await updateGuildConfig(guild.id, { autoroleId: role.id });
            return interaction.editReply({ content: `Autorole set to ${role}. New members will receive it on join.` });
        }

        if (sub === 'remove') {
            await updateGuildConfig(guild.id, { autoroleId: null });
            return interaction.editReply({ content: 'Autorole has been disabled.' });
        }

        if (sub === 'view') {
            const config = await getGuildConfig(guild.id);
            const role = config?.autoroleId ? guild.roles.cache.get(config.autoroleId) : null;
            return interaction.editReply({
                content: role
                    ? `Current autorole: ${role}`
                    : 'No autorole is set. Use `/autorole set` to configure one.',
            });
        }
    },
};
