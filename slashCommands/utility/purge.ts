import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
const log = require('../../utils/log');
const logger = log.scope('purge');

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Deletes messages from this channel, with optional filters.')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of recent messages to scan (1–100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Only delete messages from this member')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('bots')
                .setDescription('Only delete messages sent by bots')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('contains')
                .setDescription('Only delete messages containing this text (case-insensitive)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('attachments')
                .setDescription('Only delete messages that have attachments or embeds')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    permissions: PermissionFlagsBits.ManageMessages,

    async execute(interaction: ChatInputCommandInteraction) {
        const amount      = interaction.options.getInteger('amount');
        const filterUser  = interaction.options.getUser('user');
        const filterBots  = interaction.options.getBoolean('bots');
        const filterText  = interaction.options.getString('contains');
        const filterAttachments = interaction.options.getBoolean('attachments');

        const hasFilters = filterUser !== null || filterBots !== null || filterText !== null || filterAttachments !== null;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            if (!hasFilters) return await bulkDeleteWithoutFilters(interaction, amount);
            return await bulkDeleteWithFilters(interaction, amount, { filterUser, filterBots, filterText, filterAttachments });
        } catch (error) {
            logger.error('Error:', error);
            return interaction.editReply({ content: 'I cannot delete messages older than 14 days, or I lack the required permissions.' });
        }
    },
};

async function bulkDeleteWithoutFilters(interaction: ChatInputCommandInteraction, amount: number) {
    const deleted = await (interaction.channel as any).bulkDelete(amount, true);
    return interaction.editReply({ content: `Successfully deleted **${deleted.size}** messages!` });
}

interface PurgeFilters {
    filterUser: any;
    filterBots: boolean | null;
    filterText: string | null;
    filterAttachments: boolean | null;
}

async function bulkDeleteWithFilters(interaction: ChatInputCommandInteraction, amount: number, { filterUser, filterBots, filterText, filterAttachments }: PurgeFilters) {
    const fetched = await (interaction.channel as any).messages.fetch({ limit: amount });

    const needle = filterText?.toLowerCase();
    const cutoff = Date.now() - FOURTEEN_DAYS_MS;

    const toDelete = fetched.filter((m: any) => {
        // Discord cannot bulk-delete messages older than 14 days.
        if (m.createdTimestamp < cutoff) return false;

        if (filterUser     && m.author.id !== filterUser.id)                      return false;
        if (filterBots     && !m.author.bot)                                      return false;
        if (needle         && !m.content.toLowerCase().includes(needle))          return false;
        if (filterAttachments && m.attachments.size === 0 && m.embeds.length === 0) return false;

        return true;
    });

    if (toDelete.size === 0) {
        return interaction.editReply({ content: `No messages in the last **${amount}** matched those filters.` });
    }

    const deleted = await (interaction.channel as any).bulkDelete(toDelete, true);
    return interaction.editReply({ content: `Deleted **${deleted.size}** of the last **${amount}** messages matching your filters.` });
}
