const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { ensureGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('toggleleveling')
        .setDescription('Enable or disable the XP leveling system for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    permissions: PermissionFlagsBits.Administrator,

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { guild } = interaction;

        const guildData = await ensureGuildConfig(guild.id);

        guildData.levelingEnabled = !guildData.levelingEnabled;
        await guildData.save();

        const status = guildData.levelingEnabled ? '**Enabled**' : '**Disabled**';
        return interaction.editReply({ content: `The leveling system is now ${status} for **${guild.name}**.` });
    },
};