import { EmbedBuilder, Message, PartialMessage, Client } from 'discord.js';
const { getLogChannel } = require('../utils/logger');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage, client: Client) {
        if (!newMessage.guild) return;
        if (newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        if (!client.editSnipeCache) client.editSnipeCache = new Map();
        if (oldMessage.content) {
            const editedAt = new Date();
            client.editSnipeCache.set(newMessage.channelId, {
                before: oldMessage.content,
                after: newMessage.content,
                author: newMessage.author,
                editedAt,
                messageURL: newMessage.url,
            });
            setTimeout(() => {
                const entry = client.editSnipeCache.get(newMessage.channelId);
                if (entry?.editedAt === editedAt) client.editSnipeCache.delete(newMessage.channelId);
            }, 5 * 60 * 1000);
        }

        const logChannel = await getLogChannel(newMessage.guild).catch(() => null);
        if (!logChannel) return;

        const author = newMessage.author;
        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setAuthor({
                name: author.username,
                iconURL: author.displayAvatarURL({ size: 64 }),
            })
            .setDescription(`**${author.username}** edited a message in <#${newMessage.channelId}> — [Jump to message](${newMessage.url})`)
            .addFields(
                { name: 'User ID', value: `\`${author.id}\``, inline: true },
                { name: 'Channel ID', value: `\`${newMessage.channelId}\``, inline: true },
                { name: 'Before', value: oldMessage.content || '*Unknown*' },
                { name: 'After', value: newMessage.content || '*Empty*' }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};