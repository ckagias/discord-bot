const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('database')
        .setDescription('Shows the current size and statistics of the MongoDB database.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            if (mongoose.connection.readyState !== 1) {
                return interaction.editReply('The bot is not currently connected to the database.');
            }

            const stats = await mongoose.connection.db.stats();
            // MongoDB returns sizes in bytes — convert to MB
            const dataSizeMB = (stats.dataSize / (1024 * 1024)).toFixed(2);
            const storageSizeMB = (stats.storageSize / (1024 * 1024)).toFixed(2);

            const embed = new EmbedBuilder()
                .setTitle('📊 Database Storage Stats')
                .setColor('Green')
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
            console.error('[database] Error:', error);
            await interaction.editReply('An error occurred while fetching database statistics.');
        }
    },
};