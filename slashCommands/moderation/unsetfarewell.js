const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildSchema = require('../../models/GuildSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unsetfarewell')
        .setDescription('Disable farewell messages for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        await GuildSchema.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { $set: { farewellChannelId: null, farewellMessage: null }, $setOnInsert: { guildId: interaction.guild.id } },
            { upsert: true }
        );

        return interaction.editReply({ content: 'Farewell messages have been disabled.' });
    },
};