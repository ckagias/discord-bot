import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('membercount')
        .setDescription('Returns current members of this server'),

    async execute(interaction: ChatInputCommandInteraction) {
        const { guild } = interaction;

        const embed = new EmbedBuilder()
            .setTitle(`👥 Members in ${guild.name}`)
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setDescription(`This server has **${guild.memberCount} members**.`)
            .setThumbnail(guild.iconURL({ dynamic: true } as any))
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
