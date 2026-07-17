import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import { getGuildConfig, updateGuildConfig } from '../../utils/guildConfig';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('levelrole')
        .setDescription('Manage roles that are automatically granted when a member reaches a level.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Assign a role to a level (replaces an existing mapping at the same level).')
                .addIntegerOption(o =>
                    o.setName('level').setDescription('Level at which the role is granted.').setRequired(true).setMinValue(1))
                .addRoleOption(o =>
                    o.setName('role').setDescription('Role to grant.').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove the level role mapping at a specific level.')
                .addIntegerOption(o =>
                    o.setName('level').setDescription('Level to remove the mapping for.').setRequired(true).setMinValue(1)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show all configured level role mappings for this server.')),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const guildData = await getGuildConfig(interaction.guild.id);
        const levelRoles = guildData?.levelRoles ?? [];

        if (sub === 'list') {
            if (levelRoles.length === 0) {
                return interaction.editReply({ content: 'No level roles configured. Use `/levelrole set` to add one.' });
            }

            const sorted = [...levelRoles].sort((a, b) => a.level - b.level);
            const embed = new EmbedBuilder()
                .setTitle('Level Roles')
                .setColor(0x5865f2)
                .setDescription(
                    sorted.map(lr => `**Level ${lr.level}** → <@&${lr.roleId}>`).join('\n')
                );
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'set') {
            const level = interaction.options.getInteger('level');
            const role  = interaction.options.getRole('role');

            if ((role as any).managed) {
                return interaction.editReply({ content: 'That role is managed by an integration and cannot be assigned.' });
            }
            if (role.id === interaction.guild.id) {
                return interaction.editReply({ content: 'You cannot assign `@everyone` as a level role.' });
            }
            if (interaction.guild.members.me.roles.highest.position <= (role as any).position) {
                return interaction.editReply({ content: 'I cannot assign that role — it is at or above my highest role.' });
            }

            const updated = levelRoles.filter(lr => lr.level !== level);
            updated.push({ level, roleId: role.id } as any);
            await updateGuildConfig(interaction.guild.id, { levelRoles: updated });

            return interaction.editReply({ content: `Level role set: **Level ${level}** → ${role}` });
        }

        if (sub === 'remove') {
            const level = interaction.options.getInteger('level');
            const exists = levelRoles.some(lr => lr.level === level);

            if (!exists) {
                return interaction.editReply({ content: `No level role mapping found for **Level ${level}**.` });
            }

            await updateGuildConfig(interaction.guild.id, {
                levelRoles: levelRoles.filter(lr => lr.level !== level),
            });

            return interaction.editReply({ content: `Removed level role mapping for **Level ${level}**.` });
        }
    },
};
