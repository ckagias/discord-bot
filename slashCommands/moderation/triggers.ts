import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
const TriggerSchema = require('../../models/TriggerSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('triggers')
        .setDescription('List all trigger words configured for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    permissions: PermissionFlagsBits.ManageMessages,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const triggers = await TriggerSchema.find({ guildId: interaction.guild.id });

        if (triggers.length === 0) {
            return interaction.editReply({ content: 'No triggers configured. Add one with `/addtrigger`.' });
        }

        const embed = new EmbedBuilder()
            .setTitle(`Triggers for ${interaction.guild.name}`)
            .setColor(0x5865F2)
            .setDescription(
                triggers.map((t: any, i: number) => `**${i + 1}.** \`${t.trigger}\` → ${t.response}`).join('\n')
            )
            .setFooter({ text: `${triggers.length} trigger${triggers.length === 1 ? '' : 's'} total` });

        return interaction.editReply({ embeds: [embed] });
    },
};
