import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
const { updateGuildConfig } = require('../../utils/guildConfig');
const { CATEGORY_FIELDS } = require('../../utils/logger');

const CATEGORY_CHOICES = [
    { name: 'All (default)', value: 'all' },
    { name: 'Member (joins/leaves/updates)', value: 'member' },
    { name: 'Moderation (bans/warns/automod/antiraid)', value: 'moderation' },
    { name: 'Message (edits/deletes)', value: 'message' },
    { name: 'Voice (voice state changes)', value: 'voice' },
];

function fieldFor(category: string) {
    return category === 'all' ? 'logChannelId' : CATEGORY_FIELDS[category];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('Manage server event logging.')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set the channel where server events will be logged.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The text channel to send logs to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Event category to route to this channel. Defaults to all categories.')
                        .addChoices(...CATEGORY_CHOICES))
        )
        .addSubcommand(sub =>
            sub.setName('unset')
                .setDescription('Disable event logging for this server.')
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Event category to unset. Defaults to all categories.')
                        .addChoices(...CATEGORY_CHOICES))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    permissions: PermissionFlagsBits.ManageGuild,

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const category = interaction.options.getString('category') ?? 'all';
        const field = fieldFor(category);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (sub === 'set') {
            const channel = interaction.options.getChannel('channel');

            await updateGuildConfig(interaction.guild.id, { [field]: channel.id });

            const label = CATEGORY_CHOICES.find(c => c.value === category)!.name;
            return interaction.editReply({ content: `${label} log channel set to ${channel}.` });
        }

        if (sub === 'unset') {
            await updateGuildConfig(interaction.guild.id, { [field]: null });

            const label = CATEGORY_CHOICES.find(c => c.value === category)!.name;
            return interaction.editReply({ content: `${label} logging has been disabled.` });
        }
    },
};
