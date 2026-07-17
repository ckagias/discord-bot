import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
const mongoose = require('mongoose');
const log = require('../../utils/log');
const logger = log.scope('database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('database')
        .setDescription('Shows the current size and statistics of the MongoDB database.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    permissions: PermissionFlagsBits.Administrator,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            if (mongoose.connection.readyState !== 1) {
                return interaction.editReply({ content: 'The bot is not currently connected to the database.' });
            }

            const stats = await mongoose.connection.db.stats();
            // MongoDB returns sizes in bytes — convert to MB
            const dataSizeMB = (stats.dataSize / (1024 * 1024)).toFixed(2);
            const storageSizeMB = (stats.storageSize / (1024 * 1024)).toFixed(2);

            const embed = new EmbedBuilder()
                .setTitle('📊 Database Storage Stats')
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .addFields(
                    { name: '🗄️ Database Name', value: `\`${stats.db}\``, inline: true },
                    { name: '📁 Collections', value: `\`${stats.collections}\``, inline: true },
                    { name: '📄 Total Documents', value: `\`${stats.objects}\``, inline: true },
                    { name: '💾 Raw Data Size', value: `\`${dataSizeMB} MB\``, inline: true },
                    { name: '💽 Disk Storage Used', value: `\`${storageSizeMB} MB\``, inline: true }
                )
                .setFooter({ text: 'MongoDB' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error:', error);
            await interaction.editReply({ content: 'An error occurred while fetching database statistics.' });
        }
    },
};
