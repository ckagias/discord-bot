import { EmbedBuilder, MessageReaction } from 'discord.js';
import { getGuildConfig } from './guildConfig';
import StarboardSchema from '../models/StarboardSchema';
import log = require('./log');
const logger = log.scope('starboard');

async function handleStarReaction(reaction: MessageReaction): Promise<void> {
    if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }

    const { message, emoji } = reaction;
    if (!message.guild) return;

    const config = await getGuildConfig(message.guild.id).catch(() => null);
    if (!config?.starboardEnabled || !config.starboardChannelId) return;

    // emoji.id for custom emoji, emoji.name for unicode
    const emojiKey = emoji.id ?? emoji.name;
    const configKey = config.starboardEmoji;
    if (emojiKey !== configKey) return;

    if (message.author?.bot) return;
    if (message.channel.id === config.starboardChannelId) return;
    if (config.starboardIgnoreNsfw && (message.channel as any).nsfw) return;

    const count = message.reactions.cache.get(emojiKey as string)?.count ?? 0;

    const guildId = message.guild.id;
    const channelId = message.channel.id;
    const messageId = message.id;

    const existing = await StarboardSchema.findOne({ guildId, messageId }).catch(() => null);

    const starboardChannel = message.guild.channels.cache.get(config.starboardChannelId);
    if (!starboardChannel?.isTextBased()) return;

    if (!existing) {
        if (count < config.starboardThreshold) return;

        const embed = buildEmbed(message, guildId, channelId, messageId);
        const posted = await starboardChannel.send({
            content: `${config.starboardEmoji} **${count}** | <#${channelId}>`,
            embeds: [embed],
        }).catch(err => { logger.error('Failed to post message:', err); return null; });

        if (!posted) return;

        await StarboardSchema.create({
            guildId,
            channelId,
            messageId,
            starboardMessageId: posted.id,
            starCount: count,
        }).catch(err => logger.error('Failed to save doc:', err));

    } else if (count >= config.starboardThreshold) {
        const postedMsg = await starboardChannel.messages.fetch(existing.starboardMessageId).catch(() => null);
        if (postedMsg) {
            const embed = buildEmbed(message, guildId, channelId, messageId);
            await postedMsg.edit({
                content: `${config.starboardEmoji} **${count}** | <#${channelId}>`,
                embeds: [embed],
            }).catch(err => logger.error('Failed to edit message:', err));
        }
        existing.starCount = count;
        await existing.save().catch(err => logger.error('Failed to update doc:', err));

    } else {
        const postedMsg = await starboardChannel.messages.fetch(existing.starboardMessageId).catch(() => null);
        if (postedMsg) {
            await postedMsg.delete().catch(() => null);
        }
        await existing.deleteOne().catch(err => logger.error('Failed to delete doc:', err));
    }
}

function buildEmbed(message: MessageReaction['message'], guildId: string, channelId: string, messageId: string): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(Math.floor(Math.random() * 0xFFFFFF))
        .setAuthor({
            name: message.author!.tag,
            iconURL: message.author!.displayAvatarURL(),
        })
        .setDescription(message.content || null)
        .addFields({
            name: '​',
            value: `[**Click to jump to message!**](https://discord.com/channels/${guildId}/${channelId}/${messageId})`,
        })
        .setTimestamp(message.createdAt);

    const image = message.attachments.find(a => a.contentType?.startsWith('image/'));
    if (image) embed.setImage(image.url);

    return embed;
}

export { handleStarReaction };
