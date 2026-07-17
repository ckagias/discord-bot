import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
const TriggerSchema = require('../../models/TriggerSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addtrigger')
        .setDescription('Add a trigger word and the bot\'s response to it.')
        .addStringOption(option =>
            option.setName('trigger')
                .setDescription('The word that triggers the response')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('response')
                .setDescription('What the bot replies with')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    permissions: PermissionFlagsBits.ManageMessages,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const trigger = interaction.options.getString('trigger').toLowerCase();
        const response = interaction.options.getString('response');

        const existing = await TriggerSchema.findOne({ guildId: interaction.guild.id, trigger });
        if (existing) {
            return interaction.editReply({ content: `A trigger for \`${trigger}\` already exists. Remove it first with \`/removetrigger\`.` });
        }

        await TriggerSchema.create({ guildId: interaction.guild.id, trigger, response });
        return interaction.editReply({ content: `Trigger added: \`${trigger}\` → ${response}` });
    },
};
