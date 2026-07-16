import { EmbedBuilder, Message, PartialMessage, Client } from 'discord.js';
const { getLogChannel } = require('../utils/logger');

module.exports = {
    name: 'messageDelete',
    async execute(message: Message | PartialMessage, client: Client) {
        if (!message.guild) return;
        if (message.author?.bot) return;

        if (!client.snipeCache) client.snipeCache = new Map();
        if (message.content || message.attachments?.size) {
            const deletedAt = new Date();
            client.snipeCache.set(message.channelId, {
                content: message.content || null,
                attachmentURL: message.attachments?.first()?.url ?? null,
                author: message.author,
                deletedAt,
            });
            setTimeout(() => {
                const entry = client.snipeCache.get(message.channelId);
                if (entry?.deletedAt === deletedAt) client.snipeCache.delete(message.channelId);
            }, 5 * 60 * 1000);
        }

        const logChannel = await getLogChannel(message.guild).catch(() => null);
        if (!logChannel) return;

        const author = message.author;
        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setAuthor({
                name: author ? author.username : 'Unknown User',
                iconURL: author ? author.displayAvatarURL({ size: 64 }) : undefined,
            })
            .setDescription(
                author
                    ? `**${author.username}** deleted a message in <#${message.channelId}>`
                    : `A message was deleted in <#${message.channelId}>`
            )
            .addFields(
                { name: 'User ID', value: `\`${author?.id ?? 'Unknown'}\``, inline: true },
                { name: 'Channel ID', value: `\`${message.channelId}\``, inline: true },
                { name: 'Content', value: message.content || '*No text content*' }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};